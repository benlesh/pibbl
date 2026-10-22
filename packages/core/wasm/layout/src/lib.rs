//! Experimental region-owned f64 Flex allocator. No rendering or scheduling.
use std::cell::RefCell;
const STRIDE: usize = 10; // basis, min, max, padding, grow, shrink, result, frozen/offset, margin before, margin after
#[derive(Default)]
struct Arena { nodes: Vec<f64>, lines: Vec<(usize, usize)>, cross: Vec<f64> }
struct ArenaSlot { generation: u32, arena: Option<Arena> }
struct ArenaPool { slots: Vec<ArenaSlot>, closed: bool }
thread_local! {
    static ARENAS: RefCell<ArenaPool> = const { RefCell::new(ArenaPool { slots: Vec::new(), closed: false }) };
}
fn with_arena<R>(handle: u32, generation: u32, invalid: R, work: impl FnOnce(&mut Arena) -> R) -> R {
    ARENAS.with(|pool| {
        let mut pool = pool.borrow_mut();
        if pool.closed || generation == 0 { return invalid; }
        let Some(index) = handle.checked_sub(1) else { return invalid; };
        let Some(slot) = pool.slots.get_mut(index as usize) else { return invalid; };
        if slot.generation != generation { return invalid; }
        let Some(arena) = slot.arena.as_mut() else { return invalid; };
        work(arena)
    })
}
#[no_mangle]
pub extern "C" fn arena_create() -> u32 {
    ARENAS.with(|pool| {
        let mut pool = pool.borrow_mut();
        if pool.closed { return 0; }
        for (index, slot) in pool.slots.iter_mut().enumerate() {
            if slot.arena.is_none() && slot.generation != u32::MAX {
                slot.generation += 1;
                slot.arena = Some(Arena::default());
                return (index + 1) as u32;
            }
        }
        let Some(handle) = pool.slots.len().checked_add(1).and_then(|n| u32::try_from(n).ok()) else { return 0; };
        pool.slots.push(ArenaSlot { generation: 1, arena: Some(Arena::default()) });
        handle
    })
}
#[no_mangle]
pub extern "C" fn arena_generation(handle: u32) -> u32 {
    ARENAS.with(|pool| {
        let pool = pool.borrow();
        if pool.closed { return 0; }
        let Some(index) = handle.checked_sub(1) else { return 0; };
        match pool.slots.get(index as usize) { Some(slot) if slot.arena.is_some() => slot.generation, _ => 0 }
    })
}
#[no_mangle]
pub extern "C" fn arena_dispose(handle: u32, generation: u32) -> u32 {
    ARENAS.with(|pool| {
        let mut pool = pool.borrow_mut();
        if pool.closed { return 1; }
        let Some(index) = handle.checked_sub(1) else { return 1; };
        let Some(slot) = pool.slots.get_mut(index as usize) else { return 1; };
        if slot.generation != generation || slot.arena.is_none() { return 1; }
        slot.arena = None;
        0
    })
}
#[no_mangle]
pub extern "C" fn resize(handle: u32, generation: u32, count: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(STRIDE) else { return std::ptr::null_mut(); };
        arena.nodes.resize(length, 0.0);
        arena.nodes.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn dispose() {
    ARENAS.with(|pool| {
        let mut pool = pool.borrow_mut();
        pool.closed = true;
        pool.slots = Vec::new();
    });
}

// preferred border cross, padding, min, max, auto, alignment, border result, offset, margin before, margin after.
#[no_mangle]
pub extern "C" fn resize_cross(handle: u32, generation: u32, count: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(STRIDE) else { return std::ptr::null_mut(); };
        arena.cross.resize(length, 0.0);
        arena.cross.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn place_cross(handle: u32, generation: u32, size: f64) -> u32 {
    with_arena(handle, generation, 1, |arena| align_cross(&mut arena.cross, size, false))
}
fn align_cross(records: &mut [f64], size: f64, reverse: bool) -> u32 {
    if !size.is_finite() || size < 0.0 { return 1; }
    for n in records.chunks_exact_mut(STRIDE) {
        if n[..6].iter().enumerate().any(|(i,v)| v.is_nan() || *v < 0.0 || (i != 3 && !v.is_finite()))
            || !n[8].is_finite() || !n[9].is_finite()
            || n[2] > n[3] || (n[4] != 0.0 && n[4] != 1.0)
            || n[5].fract() != 0.0 || n[5] > 3.0 { return 1; }
        // Alignment is a private numeric policy enum: stretch, start, end, center.
        let margins = n[8] + n[9];
        if !margins.is_finite() { return 1; }
        let outer = if n[4] == 1.0 && n[5] == 0.0 {
            (size - margins - n[1]).max(0.0).clamp(n[2], n[3]) + n[1]
        } else { n[0] };
        let offset = match n[5] as u32 {
            2 => size - outer - margins,
            3 => (size - outer - margins) / 2.0,
            _ => 0.0,
        };
        if !outer.is_finite() || !offset.is_finite() { return 1; }
        n[6] = outer;
        n[7] = if reverse { size - offset - n[8] - outer } else { offset + n[8] };
        if !n[7].is_finite() { return 1; }
    }
    0
}

// Reuses the solved allocation records; slot seven becomes main-axis offset.
#[no_mangle]
pub extern "C" fn place_main(handle: u32, generation: u32, main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| align_main(&mut arena.nodes, main, gap, alignment, reverse))
}
fn align_main(nodes: &mut [f64], main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 || alignment > 5 || reverse > 1 { return 1; }
    let count = nodes.len() / STRIDE;
    if count == 0 { return 0; }
    let occupied = nodes.chunks_exact(STRIDE).fold(count.saturating_sub(1) as f64 * gap, |sum,n| sum+n[6]+n[3]+n[8]+n[9]);
    let free = main - occupied;
    let (start, between) = distribution(free, count, alignment);
    let mut cursor = start;
    for n in nodes.chunks_exact_mut(STRIDE) {
        if !cursor.is_finite() { return 1; }
        n[7] = if reverse == 1 { main - cursor - n[8] - n[6] - n[3] } else { cursor + n[8] };
        cursor += n[6]+n[3]+n[8]+n[9]+gap+between;
        if !n[7].is_finite() || !cursor.is_finite() { return 1; }
    }
    if !free.is_finite() { return 1; }
    0
}

fn distribution(free: f64, count: usize, alignment: u32) -> (f64, f64) {
    if count == 0 { return (0.0, 0.0); }
    match alignment {
        1 => (free, 0.0),
        2 => (free / 2.0, 0.0),
        3 if free >= 0.0 && count > 1 => (0.0, free / (count-1) as f64),
        4 | 5 if free < 0.0 => (free / 2.0, 0.0),
        4 => { let space = free / count as f64; (space/2.0, space) },
        5 => { let space = free / (count+1) as f64; (space, space) },
        _ => (0.0, 0.0),
    }
}

// One bounded pass forms lines from hypothetical outer main sizes, then the
// existing finite freeze allocator resolves each range. All records stay owned
// by one region; line boundaries never delete sibling identities or caches.
#[no_mangle]
pub extern "C" fn solve_wrap(handle: u32, generation: u32, main: f64, gap: f64) -> u32 {
    with_arena(handle, generation, 1, |arena| {
        let lines = match form_lines(&arena.nodes, main, gap) { Ok(lines) => lines, Err(status) => return status };
        for &(start, end) in &lines {
            let status = allocate(&mut arena.nodes[start*STRIDE..end*STRIDE], main, gap);
            if status != 0 { return status; }
        }
        arena.lines = lines;
        0
    })
}
fn form_lines(nodes: &[f64], main: f64, gap: f64) -> Result<Vec<(usize, usize)>, u32> {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 { return Err(1); }
    let mut lines = Vec::new();
    let mut start = 0;
    let mut used = 0.0;
    for (i, n) in nodes.chunks_exact(STRIDE).enumerate() {
        if n[..6].iter().enumerate().any(|(j,v)| v.is_nan() || *v < 0.0 || (j != 2 && !v.is_finite())) || n[1] > n[2] || !n[8].is_finite() || !n[9].is_finite() { return Err(1); }
        let outer = n[0].clamp(n[1], n[2]) + n[3] + n[8] + n[9];
        if !outer.is_finite() { return Err(1); }
        let candidate = used + gap + outer;
        if i > start && candidate > main {
            lines.push((start, i)); start = i; used = outer;
        } else { used = if i == start { outer } else { candidate }; }
    }
    let count = nodes.len()/STRIDE;
    if start < count { lines.push((start, count)); }
    Ok(lines)
}
#[no_mangle]
pub extern "C" fn place_wrap_main(handle: u32, generation: u32, main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| {
        for &(start, end) in &arena.lines {
            let status = align_main(&mut arena.nodes[start*STRIDE..end*STRIDE], main, gap, alignment, reverse);
            if status != 0 { return status; }
        }
        0
    })
}
#[no_mangle]
pub extern "C" fn place_wrap_cross(handle: u32, generation: u32, size: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| {
        let records = &mut arena.cross;
        let lines = &arena.lines;
        if !size.is_finite() || size < 0.0 || !gap.is_finite() || gap < 0.0 || alignment > 6 || reverse > 1 { return 1; }
        if lines.last().map_or(0, |&(_,end)| end) != records.len()/STRIDE { return 1; }
        let mut sizes = Vec::with_capacity(lines.len());
        let mut occupied = lines.len().saturating_sub(1) as f64 * gap;
        for &(start, end) in lines.iter() {
            let mut cross = 0.0_f64;
            for n in records[start*STRIDE..end*STRIDE].chunks_exact(STRIDE) {
                if !n[0].is_finite() || n[0] < 0.0 || !n[8].is_finite() || !n[9].is_finite() { return 1; }
                let outer = n[0] + n[8] + n[9];
                if !outer.is_finite() { return 1; }
                cross = cross.max(outer);
            }
            occupied += cross; sizes.push(cross);
        }
        let free = size - occupied;
        if !free.is_finite() { return 1; }
        if alignment == 6 && free > 0.0 && !sizes.is_empty() {
            let extra = free / sizes.len() as f64;
            for cross in &mut sizes { *cross += extra; }
        }
        let (mut cursor, between) = distribution(free, lines.len(), alignment);
        for (&(start, end), cross) in lines.iter().zip(sizes) {
            if !cursor.is_finite() { return 1; }
            let slice = &mut records[start*STRIDE..end*STRIDE];
            let status = align_cross(slice, cross, reverse == 1);
            if status != 0 { return status; }
            for n in slice.chunks_exact_mut(STRIDE) {
                n[7] += if reverse == 1 { size - cursor - cross } else { cursor };
                if !n[7].is_finite() { return 1; }
            }
            cursor += cross + gap + between;
        }
        0
    })
}

#[no_mangle]
pub extern "C" fn solve(handle: u32, generation: u32, main: f64, gap: f64) -> u32 {
    with_arena(handle, generation, 1, |arena| allocate(&mut arena.nodes, main, gap))
}
fn allocate(nodes: &mut [f64], main: f64, gap: f64) -> u32 {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 { return 1; }
    let count = nodes.len() / STRIDE;
    let gaps = count.saturating_sub(1) as f64 * gap;
    let mut base_outer = gaps;
    let mut hypothetical = gaps;
    for n in nodes.chunks_exact_mut(STRIDE) {
        if n[..6].iter().enumerate().any(|(i,v)| v.is_nan() || *v < 0.0 || (i != 2 && !v.is_finite())) || n[1] > n[2] || !n[8].is_finite() || !n[9].is_finite() { return 1; }
        n[6] = n[0]; n[7] = 0.0;
        base_outer += n[0] + n[3] + n[8] + n[9];
        hypothetical += n[0].clamp(n[1],n[2]) + n[3] + n[8] + n[9];
    }
    if !base_outer.is_finite() || !hypothetical.is_finite() { return 1; }
    let growing = hypothetical < main;
    let initial_free = main - base_outer;
    for n in nodes.chunks_exact_mut(STRIDE) {
        let h = n[0].clamp(n[1], n[2]);
        if n[if growing {4} else {5}] == 0.0 || (growing && n[0] > h) || (!growing && n[0] < h) { n[6] = h; n[7] = 1.0; }
    }
    // Each pass freezes at least one item or returns. Finite bound is independent of floats.
    for _ in 0..=count {
        let active = nodes.chunks_exact(STRIDE).filter(|n| n[7] == 0.0).count();
        if active == 0 { return 0; }
        let fixed = nodes.chunks_exact(STRIDE).fold(gaps, |a,n| a + n[8] + n[9] + if n[7] != 0.0 {n[6]+n[3]} else {n[0]+n[3]});
        let factor_index = if growing {4} else {5};
        let max_factor = nodes.chunks_exact(STRIDE).filter(|n|n[7]==0.0).map(|n|n[factor_index]).fold(0.0_f64,f64::max);
        let max_basis = if growing {1.0} else {nodes.chunks_exact(STRIDE).filter(|n|n[7]==0.0).map(|n|n[0]).fold(0.0_f64,f64::max)};
        let weight = |n: &[f64]| if max_factor == 0.0 || max_basis == 0.0 {0.0} else {(n[factor_index]/max_factor) * if growing {1.0} else {n[0]/max_basis}};
        let total = nodes.chunks_exact(STRIDE).filter(|n|n[7]==0.0).map(weight).sum::<f64>();
        let raw = nodes.chunks_exact(STRIDE).filter(|n|n[7]==0.0).map(|n|n[factor_index]).sum::<f64>();
        let mut free = main - fixed;
        if raw < 1.0 && (initial_free*raw).abs() < free.abs() { free = initial_free*raw; }
        let mut violations = Vec::new();
        for (i,n) in nodes.chunks_exact_mut(STRIDE).enumerate() {
            if n[7] != 0.0 {continue;}
            let candidate = n[0] + if total == 0.0 {0.0} else {free * (weight(n)/total)};
            if !candidate.is_finite() { return 1; }
            n[6] = candidate.clamp(n[1],n[2]);
            if n[6] != candidate { violations.push((i,n[6]-candidate)); }
        }
        if violations.is_empty() { return 0; }
        let sum = violations.iter().map(|(_,v)|v).sum::<f64>();
        if !sum.is_finite() { return 1; }
        let mut progressed = false;
        for (i,amount) in violations {
            if sum == 0.0 || (sum > 0.0 && amount > 0.0) || (sum < 0.0 && amount < 0.0) { nodes[i*STRIDE+7]=1.0; progressed=true; }
        }
        if !progressed {return 2;}
    }
    2
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn cross_bounds_and_overflow_alignment() {
        let mut records = [0., 10., 0., 50., 1., 0., 0., 0., 0., 0.,
            120., 0., 0., f64::INFINITY, 0., 3., 0., 0., 0., 0.];
        assert_eq!(align_cross(&mut records, 80., false), 0);
        assert_eq!((records[6], records[7]), (60., 0.));
        assert_eq!((records[16], records[17]), (120., -20.));
    }
    #[test] fn main_distribution_and_overflow() {
        let mut nodes = [0.,0.,0.,2.,0.,0.,20.,0.,0.,0., 0.,0.,0.,2.,0.,0.,20.,0.,0.,0.];
        assert_eq!(align_main(&mut nodes, 100., 10., 3, 0), 0);
        assert_eq!((nodes[7], nodes[17]), (0., 78.));
        assert_eq!(align_main(&mut nodes, 30., 10., 4, 0), 0);
        assert_eq!((nodes[7], nodes[17]), (-12., 20.));
        assert_eq!(align_main(&mut nodes, 30., 10., 3, 0), 0);
        assert_eq!((nodes[7], nodes[17]), (0., 32.));
    }
    #[test] fn huge_factors_terminate() {
        let mut nodes = [80.,0.,f64::INFINITY,0.,0.,1e308,0.,0.,0.,0.,80.,0.,f64::INFINITY,0.,0.,1e308,0.,0.,0.,0.];
        assert_eq!(allocate(&mut nodes,100.,0.),0);
        assert_eq!((nodes[6],nodes[16]),(50.,50.));
    }
    #[test] fn reverse_positions_keep_signed_margin_slots_separate() {
        let mut nodes = [0.,0.,0.,0.,0.,0.,40.,0.,7.,3., 0.,0.,0.,0.,0.,0.,30.,0.,9.,5.];
        assert_eq!(align_main(&mut nodes,150.,10.,0,1),0);
        assert_eq!((nodes[7],nodes[17]),(103.,51.));
        let mut cross = [20.,0.,0.,f64::INFINITY,0.,1.,0.,0.,7.,3., 10.,0.,0.,f64::INFINITY,0.,1.,0.,0.,9.,1.];
        assert_eq!(align_cross(&mut cross,30.,true),0);
        assert_eq!((cross[7],cross[17]),(3.,11.));
    }
    #[test] fn arena_handles_isolate_cached_placement_and_reject_stale_generations() {
        let a = arena_create(); let ga = arena_generation(a);
        let b = arena_create(); let gb = arena_generation(b);
        assert_ne!(a, b);
        let pa = resize(a, ga, 2);
        let pb = resize(b, gb, 2);
        unsafe {
            std::slice::from_raw_parts_mut(pa, 20).copy_from_slice(&[80.,0.,f64::INFINITY,0.,0.,1.,0.,0.,0.,0.,80.,0.,f64::INFINITY,0.,0.,1.,0.,0.,0.,0.]);
            std::slice::from_raw_parts_mut(pb, 20).copy_from_slice(&[40.,0.,f64::INFINITY,0.,0.,1.,0.,0.,0.,0.,40.,0.,f64::INFINITY,0.,0.,1.,0.,0.,0.,0.]);
        }
        assert_eq!(solve_wrap(a,ga,100.,0.),0);
        assert_eq!(solve(b,gb,60.,0.),0);
        assert_eq!(place_wrap_main(a,ga,100.,0.,0,0),0);
        unsafe { assert_eq!((*pa.add(6),*pa.add(16),*pa.add(17)),(80.,80.,0.)); }
        assert_eq!(place_main(b,gb,60.,0.,0,0),0);
        unsafe { assert_eq!((*pb.add(6),*pb.add(16),*pb.add(17)),(30.,30.,30.)); }
        assert_eq!(arena_dispose(a,ga),0);
        assert_eq!(arena_dispose(a,ga),1);
        let c = arena_create(); let gc = arena_generation(c);
        assert_eq!(c,a); assert_ne!(gc,ga);
        assert_eq!(solve(a,ga,100.,0.),1);
        assert_eq!(place_main(b,gb,60.,0.,0,1),0);
        assert_eq!(arena_dispose(c,gc),0);
        ARENAS.with(|pool| pool.borrow_mut().slots[(c-1) as usize].generation=u32::MAX);
        let d = arena_create();
        assert_ne!(d,c); assert_eq!(arena_dispose(c,u32::MAX),1);
        dispose(); dispose();
        assert_eq!(arena_create(),0);
        assert_eq!(arena_dispose(b,gb),1);
    }

}
