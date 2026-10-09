//! Private C ABI: one worker owns one recorder and at most one GIF export.
use std::cell::RefCell;
use std::borrow::Cow;
use color_quant::NeuQuant;
use gif::{Encoder, Frame, Repeat, DisposalMethod};

struct GifJob {
    encoder: Encoder<Vec<u8>>,
    quantizer: Option<NeuQuant>,
    palette: Vec<u8>,
    transparent: Option<u8>,
    dithering: bool,
    source_width: usize,
    source_height: usize,
    background: Option<[u8; 3]>,
    width: u16,
    height: u16,
}
thread_local! {
    static STORE: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static SAMPLES: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static PALETTE: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static JOB: RefCell<Option<GifJob>> = const { RefCell::new(None) };
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[no_mangle]
pub extern "C" fn initialize(bytes: usize) -> u32 {
    STORE.with(|store| { let mut data = store.borrow_mut(); data.clear(); data.try_reserve_exact(bytes).is_ok() as u32 })
}
#[no_mangle]
pub extern "C" fn append_frame(bytes: usize) -> usize {
    STORE.with(|store| {
        let mut data = store.borrow_mut();
        let offset = data.len();
        if data.try_reserve(bytes).is_err() { return 0; }
        data.resize(offset + bytes, 0);
        unsafe { data.as_mut_ptr().add(offset) as usize }
    })
}
#[no_mangle]
pub extern "C" fn store_base() -> usize { STORE.with(|store| store.borrow().as_ptr() as usize) }
fn background(value: i32) -> Option<[u8; 3]> {
    if value < 0 { None } else { Some([(value >> 16) as u8, (value >> 8) as u8, value as u8]) }
}
fn flatten(pixel: &[u8], bg: Option<[u8; 3]>) -> [u8; 4] {
    if let Some(bg) = bg {
        let a = pixel[3] as u32;
        [((pixel[0] as u32*a + bg[0] as u32*(255-a)+127)/255) as u8,
         ((pixel[1] as u32*a + bg[1] as u32*(255-a)+127)/255) as u8,
         ((pixel[2] as u32*a + bg[2] as u32*(255-a)+127)/255) as u8, 255]
    } else { [pixel[0], pixel[1], pixel[2], 255] }
}
// Pixel-center bilinear resize with premultiplied alpha, avoiding transparent-edge halos.
fn pixel_at(data: &[u8], sw: usize, sh: usize, width: usize, height: usize, x: usize, y: usize) -> [u8; 4] {
    if sw == width && sh == height {
        let i = (y * sw + x) * 4;
        return [data[i], data[i+1], data[i+2], data[i+3]];
    }
    let sx = ((x as f32 + 0.5) * sw as f32 / width as f32 - 0.5).clamp(0.0, (sw-1) as f32);
    let sy = ((y as f32 + 0.5) * sh as f32 / height as f32 - 0.5).clamp(0.0, (sh-1) as f32);
    let x0 = sx.floor() as usize; let y0 = sy.floor() as usize;
    let fx = sx - x0 as f32; let fy = sy - y0 as f32;
    let mut sums = [0.0f32; 4];
    for (px, py, weight) in [
        (x0,y0,(1.0-fx)*(1.0-fy)), ((x0+1).min(sw-1),y0,fx*(1.0-fy)),
        (x0,(y0+1).min(sh-1),(1.0-fx)*fy), ((x0+1).min(sw-1),(y0+1).min(sh-1),fx*fy),
    ] {
        let i = (py*sw+px)*4; let alpha = data[i+3] as f32;
        sums[3] += alpha*weight;
        for c in 0..3 { sums[c] += data[i+c] as f32*alpha*weight; }
    }
    if sums[3] == 0.0 { return [0,0,0,0]; }
    [(sums[0]/sums[3]).round() as u8, (sums[1]/sums[3]).round() as u8,
     (sums[2]/sums[3]).round() as u8, sums[3].round() as u8]
}
#[no_mangle]
pub extern "C" fn palette_allocate(length: usize) -> usize {
    PALETTE.with(|palette| { let mut p = palette.borrow_mut(); p.resize(length, 0); p.as_mut_ptr() as usize })
}
#[no_mangle]
pub extern "C" fn sample_frame(offset: usize, sw: usize, sh: usize, width: usize, height: usize, stride: usize, bg: i32) {
    STORE.with(|store| SAMPLES.with(|samples| {
        let data = store.borrow(); let mut samples = samples.borrow_mut();
        let data = &data[offset..offset+sw*sh*4];
        for i in (0..width*height).step_by(stride.max(1)) {
            let pixel = pixel_at(data,sw,sh,width,height,i%width,i/width);
            if bg >= 0 || pixel[3] >= 128 { samples.extend_from_slice(&flatten(&pixel, background(bg))); }
        }
    }));
}
#[no_mangle]
pub extern "C" fn gif_begin(width: u16, height: u16, repeat: i32, bg: i32, sw: usize, sh: usize, max_colors: usize, sample_factor: i32, dithering: u32) -> u32 {
    SAMPLES.with(|samples| JOB.with(|job| PALETTE.with(|supplied| {
        let mut samples = samples.borrow_mut();
        let mut palette = std::mem::take(&mut *supplied.borrow_mut());
        let quantizer = if palette.is_empty() {
            if samples.is_empty() { samples.extend_from_slice(&[0,0,0,255]); }
            let q = NeuQuant::new(sample_factor, max_colors - if bg < 0 { 1 } else { 0 }, &samples);
            palette = q.color_map_rgb(); Some(q)
        } else { None };
        let transparent = if bg < 0 { let index = (palette.len()/3) as u8; palette.extend_from_slice(&[0,0,0]); Some(index) } else { None };
        *samples = Vec::new();
        let Ok(mut encoder) = Encoder::new(Vec::new(), width, height, &palette) else { return 0; };
        if repeat >= 0 && encoder.set_repeat(if repeat == 0 { Repeat::Infinite } else { Repeat::Finite(repeat as u16) }).is_err() { return 0; }
        *job.borrow_mut() = Some(GifJob { encoder, quantizer, palette, transparent, dithering: dithering != 0,
            source_width: sw, source_height: sh, background: background(bg), width, height });
        1
    })))
}
fn palette_index(job: &GifJob, pixel: &[u8;4]) -> usize {
    if let Some(q) = &job.quantizer { return q.index_of(pixel); }
    let colors = job.palette.len()/3 - if job.transparent.is_some() { 1 } else { 0 };
    (0..colors).min_by_key(|&i| {
        (0..3).map(|c| { let d = pixel[c] as i32-job.palette[i*3+c] as i32; d*d }).sum::<i32>()
    }).unwrap_or(0)
}
#[no_mangle]
pub extern "C" fn gif_frame(offset: usize, delay: u16) -> u32 {
    STORE.with(|store| JOB.with(|job| {
        let data = store.borrow(); let mut job = job.borrow_mut();
        let Some(job) = job.as_mut() else { return 0; };
        let width = job.width as usize; let height = job.height as usize;
        let data = &data[offset..offset+job.source_width*job.source_height*4];
        let mut indexes = Vec::with_capacity(width*height);
        // Scratch belongs to this frame and is dropped before yielding/cancellation.
        let mut errors = if job.dithering { vec![[0.0f32;3]; width+2] } else { Vec::new() };
        let mut next = errors.clone();
        for y in 0..height {
            for x in 0..width {
                let pixel = pixel_at(data,job.source_width,job.source_height,width,height,x,y);
                if let Some(index) = job.transparent {
                    if pixel[3] < 128 { indexes.push(index); continue; }
                }
                let mut color = flatten(&pixel,job.background);
                if job.dithering {
                    for c in 0..3 { color[c] = (color[c] as f32+errors[x+1][c]).clamp(0.0,255.0).round() as u8; }
                }
                let index = palette_index(job,&color); indexes.push(index as u8);
                if job.dithering {
                    for c in 0..3 {
                        let error = color[c] as f32-job.palette[index*3+c] as f32;
                        errors[x+2][c] += error*7.0/16.0;
                        next[x][c] += error*3.0/16.0;
                        next[x+1][c] += error*5.0/16.0;
                        next[x+2][c] += error/16.0;
                    }
                }
            }
            if job.dithering { std::mem::swap(&mut errors,&mut next); next.fill([0.0;3]); }
        }
        let frame = Frame {
            width: job.width, height: job.height, delay,
            dispose: if job.transparent.is_some() { DisposalMethod::Background } else { DisposalMethod::Keep },
            transparent: job.transparent, buffer: Cow::Owned(indexes), ..Frame::default()
        };
        job.encoder.write_frame(&frame).is_ok() as u32
    }))
}
#[no_mangle]
pub extern "C" fn gif_end() -> usize {
    JOB.with(|job| OUTPUT.with(|output| {
        let Some(job) = job.borrow_mut().take() else { return 0; };
        let Ok(bytes) = job.encoder.into_inner() else { return 0; };
        let len = bytes.len(); *output.borrow_mut() = bytes; len
    }))
}
#[no_mangle]
pub extern "C" fn output_base() -> usize { OUTPUT.with(|output| output.borrow().as_ptr() as usize) }
#[no_mangle]
pub extern "C" fn gif_clear() {
    JOB.with(|job| *job.borrow_mut() = None);
    SAMPLES.with(|samples| *samples.borrow_mut() = Vec::new());
    OUTPUT.with(|output| *output.borrow_mut() = Vec::new());
    PALETTE.with(|palette| *palette.borrow_mut() = Vec::new());
}
