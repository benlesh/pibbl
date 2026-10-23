//! Experimental region-owned f64 Flex allocator. No rendering or scheduling.
use std::cell::RefCell;
const STRIDE: usize = 10; // basis, min, max, padding, grow, shrink, result, frozen/offset, margin before, margin after
#[derive(Default)]
struct Arena { nodes: Vec<f64>, main_auto: Vec<f64>, lines: Vec<(usize, usize)>, cross: Vec<f64>, grid: [Vec<f64>;2], grid_offsets: [Vec<f64>;2], grid_gaps: [f64;2], grid_ready: [bool;2], grid_cells: Vec<f64>, flow: Vec<f64> }
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
pub extern "C" fn layout_abi_v3() -> u32 { 3 }
#[no_mangle]
pub extern "C" fn place_cross(handle: u32, generation: u32, size: f64, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| align_cross(&mut arena.cross, size, reverse != 0))
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

#[no_mangle]
pub extern "C" fn resize_flow(handle: u32, generation: u32, count: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(8) else { return std::ptr::null_mut(); };
        arena.flow.resize(length,0.0); arena.flow.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn place_flow(handle: u32, generation: u32, bound: f64, gap: f64, line_gap: f64, wrap: u32) -> u32 {
    with_arena(handle,generation,1,|arena| arrange_flow(&mut arena.flow,bound,gap,line_gap,wrap))
}
fn arrange_flow(items: &mut [f64], bound: f64, gap: f64, line_gap: f64, wrap: u32) -> u32 {
    if items.len()%8 != 0 || !bound.is_finite() || bound < 0.0 || !gap.is_finite() || gap < 0.0 || !line_gap.is_finite() || line_gap < 0.0 || wrap > 1 { return 1; }
    for item in items.chunks_exact(8) {
        if !item[0].is_finite() || item[0] < 0.0 || !item[1].is_finite() || item[1] < 0.0 || !item[2].is_finite() || item[2] < 0.0 || item[2] > 3.0 || item[2].fract() != 0.0 { return 1; }
    }
    let count = items.len()/8;
    let mut start = 0; let mut cross_cursor = 0.0;
    while start < count {
        let mut end = start; let mut occupied = 0.0; let mut line_cross: f64 = 0.0;
        while end < count {
            let main = items[end*8];
            let next = if end == start { main } else { occupied + gap + main };
            if wrap == 1 && end > start && next > bound { break; }
            occupied = next; line_cross = line_cross.max(items[end*8+1]); end += 1;
        }
        let mut main_cursor = 0.0;
        for index in start..end {
            let item = &mut items[index*8..index*8+8];
            let cross_offset = if item[2] == 1.0 { (line_cross-item[1])/2.0 } else if item[2] == 2.0 { line_cross-item[1] } else { 0.0 };
            item[3] = main_cursor; item[4] = cross_cursor + cross_offset;
            item[5] = if item[2] == 3.0 { line_cross } else { item[1] };
            if !item[3].is_finite() || !item[4].is_finite() || !item[5].is_finite() { return 1; }
            main_cursor += item[0] + gap;
        }
        cross_cursor += line_cross + line_gap; start = end;
    }
    0
}

// Independent per-region Grid track records: kind, numeric value, result.
#[no_mangle]
pub extern "C" fn resize_grid(handle: u32, generation: u32, count: usize, axis: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(3) else { return std::ptr::null_mut(); };
        if axis > 1 { return std::ptr::null_mut(); }
        arena.grid_ready[axis] = false;
        arena.grid[axis].resize(length, 0.0);
        arena.grid[axis].as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn resolve_grid_tracks(handle: u32, generation: u32, bound: f64, gap: f64, axis: usize) -> u32 {
    with_arena(handle, generation, 1, |arena| {
        if axis > 1 { return 1; }
        let status = resolve_tracks(&mut arena.grid[axis], bound, gap);
        if status != 0 { return status; }
        arena.grid_ready[axis] = true;
        arena.grid_gaps[axis] = gap;
        arena.grid_offsets[axis].resize(arena.grid[axis].len()/3,0.0);
        let mut sum = 0.0;
        for (index, track) in arena.grid[axis].chunks_exact(3).enumerate() {
            arena.grid_offsets[axis][index] = sum + index as f64 * gap;
            sum += track[2];
        }
        0
    })
}
#[no_mangle]
pub extern "C" fn resize_grid_cells(handle: u32, generation: u32, count: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(8) else { return std::ptr::null_mut(); };
        arena.grid_cells.resize(length,0.0); arena.grid_cells.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn place_grid_cells(handle: u32, generation: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| {
        if !arena.grid_ready[0] || !arena.grid_ready[1] { return 1; }
        for cell in arena.grid_cells.chunks_exact_mut(8) {
            for axis in 0..2 {
                let start = cell[axis*2]; let span = cell[axis*2+1];
                let count = arena.grid[axis].len()/3;
                if !start.is_finite() || !span.is_finite() || start < 0.0 || span < 1.0 || start.fract() != 0.0 || span.fract() != 0.0 || start + span > count as f64 { return 1; }
                let offset = arena.grid_offsets[axis][start as usize];
                let mut size = 0.0;
                for index in start as usize..(start+span) as usize { size += arena.grid[axis][index*3+2]; }
                size += (span-1.0)*arena.grid_gaps[axis];
                if !offset.is_finite() || !size.is_finite() || size < 0.0 { return 1; }
                cell[4+axis] = offset; cell[6+axis] = size;
            }
        }
        0
    })
}
fn resolve_tracks(tracks: &mut [f64], bound: f64, gap: f64) -> u32 {
    if tracks.len() % 3 != 0 || !bound.is_finite() || bound < 0.0 || !gap.is_finite() || gap < 0.0 { return 1; }
    let mut allocated = (tracks.len() / 3).saturating_sub(1) as f64 * gap;
    let mut fractions = 0.0;
    for track in tracks.chunks_exact_mut(3) {
        if !track[1].is_finite() || track[1] < 0.0 { return 1; }
        track[2] = if track[0] == 0.0 { track[1] }
            else if track[0] == 1.0 { bound * track[1] / 100.0 }
            else if track[0] == 2.0 { fractions += track[1]; 0.0 }
            else { return 1; };
        allocated += track[2];
    }
    if !allocated.is_finite() || !fractions.is_finite() { return 1; }
    let unit = (bound - allocated).max(0.0) / fractions.max(1.0);
    for track in tracks.chunks_exact_mut(3) {
        if track[0] == 2.0 { track[2] = unit * track[1]; }
        if !track[2].is_finite() || track[2] < 0.0 { return 1; }
    }
    0
}

// Reuses the solved allocation records; slot seven becomes main-axis offset.
#[no_mangle]
pub extern "C" fn place_main(handle: u32, generation: u32, main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| align_main(&mut arena.nodes, main, gap, alignment, reverse))
}
#[no_mangle]
pub extern "C" fn resize_main_auto(handle: u32, generation: u32, count: usize) -> *mut f64 {
    with_arena(handle, generation, std::ptr::null_mut(), |arena| {
        let Some(length) = count.checked_mul(2) else { return std::ptr::null_mut(); };
        arena.main_auto.resize(length, 0.0);
        arena.main_auto.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn place_main_auto(handle: u32, generation: u32, main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    with_arena(handle, generation, 1, |arena| align_main_auto(&mut arena.nodes, &arena.main_auto, main, gap, alignment, reverse))
}
fn align_main_auto(nodes: &mut [f64], flags: &[f64], main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 || alignment > 5 || reverse > 1 { return 1; }
    let count = nodes.len() / STRIDE;
    if flags.len() != count * 2 { return 1; }
    let mut slots = 0;
    let mut occupied = count.saturating_sub(1) as f64 * gap;
    for index in 0..count {
        let before = flags[index * 2]; let after = flags[index * 2 + 1];
        if (before != 0.0 && before != 1.0) || (after != 0.0 && after != 1.0) { return 1; }
        slots += before as usize + after as usize;
        let n = &nodes[index * STRIDE..(index + 1) * STRIDE];
        occupied += n[6] + n[3] + n[8] + n[9];
    }
    let free = main - occupied;
    if !free.is_finite() { return 1; }
    let consumes_free = free > 0.0 && slots > 0;
    let share = if consumes_free { free / slots as f64 } else { 0.0 };
    let (mut cursor, between) = distribution(free, count, if consumes_free { 0 } else { alignment }, reverse == 1);
    for index in 0..count {
        let n = &mut nodes[index * STRIDE..(index + 1) * STRIDE];
        let before = n[8] + flags[index * 2] * share;
        let after = n[9] + flags[index * 2 + 1] * share;
        n[7] = if reverse == 1 { main - cursor - before - n[6] - n[3] } else { cursor + before };
        cursor += n[6] + n[3] + before + after + gap + between;
        if !n[7].is_finite() || !cursor.is_finite() { return 1; }
    }
    0
}
fn align_main(nodes: &mut [f64], main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 || alignment > 5 || reverse > 1 { return 1; }
    let count = nodes.len() / STRIDE;
    if count == 0 { return 0; }
    let occupied = nodes.chunks_exact(STRIDE).fold(count.saturating_sub(1) as f64 * gap, |sum,n| sum+n[6]+n[3]+n[8]+n[9]);
    let free = main - occupied;
    let (start, between) = distribution(free, count, alignment, reverse == 1);
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

fn distribution(free: f64, count: usize, alignment: u32, reverse: bool) -> (f64, f64) {
    if count == 0 { return (0.0, 0.0); }
    match alignment {
        1 => (free, 0.0),
        2 => (free / 2.0, 0.0),
        3 if free >= 0.0 && count > 1 => (0.0, free / (count-1) as f64),
        4 | 5 if free < 0.0 => (if reverse { free } else { 0.0 }, 0.0),
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
pub extern "C" fn place_wrap_main_auto(handle: u32, generation: u32, main: f64, gap: f64, alignment: u32, reverse: u32) -> u32 {
    if !main.is_finite() || main < 0.0 || !gap.is_finite() || gap < 0.0 || alignment > 5 || reverse > 1 { return 1; }
    with_arena(handle, generation, 1, |arena| {
        let count = arena.nodes.len() / STRIDE;
        if arena.main_auto.len() != count * 2 || arena.lines.last().map_or(0, |&(_, end)| end) != count { return 1; }
        for &(start, end) in &arena.lines {
            let status = align_main_auto(
                &mut arena.nodes[start*STRIDE..end*STRIDE],
                &arena.main_auto[start*2..end*2],
                main, gap, alignment, reverse,
            );
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
        let (mut cursor, between) = distribution(free, lines.len(), alignment, reverse == 1);
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
    let mut initial_outer = gaps;
    for n in nodes.chunks_exact_mut(STRIDE) {
        let h = n[0].clamp(n[1], n[2]);
        if n[if growing {4} else {5}] == 0.0 || (growing && n[0] > h) || (!growing && n[0] < h) { n[6] = h; n[7] = 1.0; }
        initial_outer += n[6] + n[3] + n[8] + n[9];
    }
    let initial_free = main - initial_outer;
    if !initial_free.is_finite() { return 1; }
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
    #[test] fn partial_free_space_uses_initially_frozen_sizes() {
        let mut grow = [20.,0.,10.,0.,0.25,0.,0.,0.,0.,0.,20.,0.,f64::INFINITY,0.,0.25,0.,0.,0.,0.,0.];
        assert_eq!(allocate(&mut grow,112.,12.),0);
        assert_eq!((grow[6],grow[16]),(10.,37.5));
        let mut shrink = [80.,90.,f64::INFINITY,0.,0.,0.25,0.,0.,0.,0.,80.,0.,f64::INFINITY,0.,0.,0.25,0.,0.,0.,0.];
        assert_eq!(allocate(&mut shrink,112.,12.),0);
        assert_eq!((shrink[6],shrink[16]),(90.,62.5));
    }

    #[test] fn numeric_gap_cardinality_has_no_phantom_edges() {
        assert_eq!(allocate(&mut [], 100., 10.), 0);
        assert_eq!(align_main(&mut [], 100., 10., 0, 0), 0);
        let mut one = [40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.];
        assert_eq!(allocate(&mut one,100.,10.),0);
        assert_eq!(align_main(&mut one,100.,10.,3,0),0);
        assert_eq!((one[6],one[7]),(40.,0.));
        let mut two = [40.,0.,f64::INFINITY,0.,1.,0.,0.,0.,0.,0.,40.,0.,f64::INFINITY,0.,1.,0.,0.,0.,0.,0.];
        assert_eq!(allocate(&mut two,100.,10.),0);
        assert_eq!(align_main(&mut two,100.,10.,0,0),0);
        assert_eq!((two[6],two[7],two[16],two[17]),(45.,0.,45.,55.));
    }

    use super::*;
    #[test] fn flow_lines_wrap_align_and_reject_invalid_inputs() {
        let mut items = [30.,20.,1.,0.,0.,0.,0.,0., 20.,10.,1.,0.,0.,0.,0.,0., 30.,15.,1.,0.,0.,0.,0.,0.];
        assert_eq!(arrange_flow(&mut items,60.,5.,7.,1),0);
        assert_eq!((items[11],items[12],items[19],items[20]),(35.,5.,0.,27.));
        assert_eq!(arrange_flow(&mut items,100.,5.,7.,1),0);
        assert_eq!((items[19],items[20]),(60.,2.5));
        items[10]=3.; assert_eq!(arrange_flow(&mut items,100.,5.,7.,0),0); assert_eq!(items[13],20.);
        items[2]=4.; assert_eq!(arrange_flow(&mut items,100.,5.,7.,0),1);
        assert_eq!(arrange_flow(&mut [],100.,-1.,7.,1),1);
        assert_eq!(arrange_flow(&mut [80.,10.,0.,0.,0.,0.,0.,0.],20.,5.,7.,1),0);
    }
    #[test] fn grid_cells_preserve_spans_precision_and_reject_invalid_or_stale_records() {
        let h = arena_create(); let g = arena_generation(h);
        let cols = resize_grid(h,g,3,0); let rows = resize_grid(h,g,2,1);
        unsafe {
            std::slice::from_raw_parts_mut(cols,9).copy_from_slice(&[0.,20.,0.,1.,25.,0.,2.,1.,0.]);
            std::slice::from_raw_parts_mut(rows,6).copy_from_slice(&[0.,20.,0.,0.,20.,0.]);
        }
        let unresolved = resize_grid_cells(h,g,1);
        unsafe { std::slice::from_raw_parts_mut(unresolved,4).copy_from_slice(&[1.,2.,0.,2.]); }
        assert_eq!(place_grid_cells(h,g),1);
        assert_eq!(resolve_grid_tracks(h,g,200.,10.,0),0);
        assert_eq!(resolve_grid_tracks(h,g,45.,5.,1),0);
        let cells = resize_grid_cells(h,g,1);
        unsafe { std::slice::from_raw_parts_mut(cells,4).copy_from_slice(&[1.,2.,0.,2.]); }
        assert_eq!(place_grid_cells(h,g),0);
        unsafe { assert_eq!((*cells.add(4),*cells.add(5),*cells.add(6),*cells.add(7)),(30.,0.,170.,45.)); }
        let huge = resize_grid(h,g,2,0);
        unsafe { std::slice::from_raw_parts_mut(huge,6).copy_from_slice(&[0.,1e20,0.,0.,1.,0.]); }
        assert_eq!(resolve_grid_tracks(h,g,100.,0.,0),0);
        unsafe { *cells.add(1)=1.; }
        assert_eq!(place_grid_cells(h,g),0);
        unsafe { assert_eq!(*cells.add(6),1.); *cells=0.5; }
        assert_eq!(place_grid_cells(h,g),1);
        assert_eq!(arena_dispose(h,g),0);
        assert!(resize_grid_cells(h,g,1).is_null()); assert_eq!(place_grid_cells(h,g),1);
    }
    #[test] fn grid_tracks_preserve_mixed_fraction_overflow_and_validation_rules() {
        let mut mixed = [0.,20.,0., 1.,25.,0., 2.,1.,0.];
        assert_eq!(resolve_tracks(&mut mixed,200.,10.),0);
        assert_eq!((mixed[2],mixed[5],mixed[8]),(20.,50.,110.));
        assert_eq!(resolve_tracks(&mut mixed,260.,10.),0);
        assert_eq!((mixed[2],mixed[5],mixed[8]),(20.,65.,155.));
        let mut fractional = [2.,0.5,0.];
        assert_eq!(resolve_tracks(&mut fractional,100.,0.),0); assert_eq!(fractional[2],50.);
        let mut overflow = [0.,200.,0., 2.,1.,0.];
        assert_eq!(resolve_tracks(&mut overflow,100.,0.),0); assert_eq!(overflow[5],0.);
        assert_eq!(resolve_tracks(&mut [1.,1e308,0.],100.,0.),1);
        assert_eq!(resolve_tracks(&mut [2.,1e308,0.,2.,1e308,0.],100.,0.),1);
        assert_eq!(resolve_tracks(&mut [f64::NAN,1.,0.],100.,0.),1);
        assert_eq!(resolve_tracks(&mut [0.,-1.,0.],100.,0.),1);
    }
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
        assert_eq!((nodes[7], nodes[17]), (0., 32.));
        assert_eq!(align_main(&mut nodes, 30., 10., 3, 0), 0);
        assert_eq!((nodes[7], nodes[17]), (0., 32.));
        for alignment in [4, 5] {
            assert_eq!(align_main(&mut nodes, 30., 10., alignment, 1), 0);
            assert_eq!((nodes[7], nodes[17]), (32., 0.));
        }
        assert_eq!(align_main(&mut nodes, 30., 10., 2, 1), 0);
        assert_eq!((nodes[7], nodes[17]), (20., -12.));
    }
    #[test] fn huge_factors_terminate() {
        let mut nodes = [80.,0.,f64::INFINITY,0.,0.,1e308,0.,0.,0.,0.,80.,0.,f64::INFINITY,0.,0.,1e308,0.,0.,0.,0.];
        assert_eq!(allocate(&mut nodes,100.,0.),0);
        assert_eq!((nodes[6],nodes[16]),(50.,50.));
        let mut unequal = [0.,0.,f64::INFINITY,0.,1e308,0.,0.,0.,0.,0.,0.,0.,f64::INFINITY,0.,1.,0.,0.,0.,0.,0.];
        assert_eq!(allocate(&mut unequal,100.,0.),0);
        assert_eq!(unequal[6],100.);
        assert!(unequal[16].is_finite() && unequal[16] > 0.);
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
        let grid_a = resize_grid(a,ga,3,0); let grid_b = resize_grid(b,gb,1,0);
        unsafe {
            std::slice::from_raw_parts_mut(grid_a,9).copy_from_slice(&[0.,20.,0.,1.,25.,0.,2.,1.,0.]);
            std::slice::from_raw_parts_mut(grid_b,3).copy_from_slice(&[2.,0.5,0.]);
        }
        assert_eq!(resolve_grid_tracks(a,ga,200.,10.,0),0);
        assert_eq!(resolve_grid_tracks(b,gb,100.,0.,0),0);
        unsafe { assert_eq!((*grid_a.add(8),*grid_b.add(2)),(110.,50.)); }
        let flow = resize_flow(a,ga,2);
        unsafe { std::slice::from_raw_parts_mut(flow,16).copy_from_slice(&[30.,20.,1.,0.,0.,0.,0.,0.,20.,10.,1.,0.,0.,0.,0.,0.]); }
        assert_eq!(place_flow(a,ga,60.,5.,7.,1),0);
        unsafe { assert_eq!((*flow.add(11),*flow.add(12)),(35.,5.)); assert_eq!(*grid_a.add(8),110.); }
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
        assert!(resize_flow(a,ga,1).is_null());
        assert_eq!(place_flow(a,ga,100.,0.,0.,0),1);
        assert!(resize_grid(a,ga,1,0).is_null());
        assert_eq!(resolve_grid_tracks(a,ga,100.,0.,0),1);
        assert_eq!(place_main(b,gb,60.,0.,0,1),0);
        assert_eq!(arena_dispose(c,gc),0);
        ARENAS.with(|pool| pool.borrow_mut().slots[(c-1) as usize].generation=u32::MAX);
        let d = arena_create();
        assert_ne!(d,c); assert_eq!(arena_dispose(c,u32::MAX),1);
        dispose(); dispose();
        assert_eq!(arena_create(),0);
        assert_eq!(arena_dispose(b,gb),1);
    }

    #[test] fn wrapped_auto_margins_share_free_space_per_line_without_rewriting_numeric_records() {
        let handle = arena_create(); let generation = arena_generation(handle);
        let pointer = resize(handle, generation, 4);
        unsafe { std::slice::from_raw_parts_mut(pointer, 40).copy_from_slice(&[
            40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.,
            40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.,
            40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.,
            40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.,
        ]); }
        assert_eq!(solve_wrap(handle, generation, 100., 0.), 0);
        let flags = resize_main_auto(handle, generation, 4);
        unsafe { std::slice::from_raw_parts_mut(flags, 8).copy_from_slice(&[1.,0.,0.,0.,1.,0.,0.,0.]); }
        assert_eq!(place_wrap_main_auto(handle, generation, 100., 0., 1, 0), 0);
        unsafe {
            let nodes = std::slice::from_raw_parts(pointer, 40);
            assert_eq!((nodes[7], nodes[17], nodes[27], nodes[37]), (20., 60., 20., 60.));
            assert_eq!((nodes[8], nodes[9], nodes[18], nodes[19], nodes[28], nodes[29], nodes[38], nodes[39]), (0.,0.,0.,0.,0.,0.,0.,0.));
        }
        assert_eq!(arena_dispose(handle, generation), 0);
    }

    #[test] fn auto_margins_place_after_sizing_without_mutating_numeric_records() {
        let mut nodes = [40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.,40.,0.,f64::INFINITY,0.,0.,0.,0.,0.,0.,0.];
        assert_eq!(allocate(&mut nodes,200.,0.),0);
        assert_eq!(align_main_auto(&mut nodes,&[1.,0.,0.,0.],200.,0.,1,0),0);
        assert_eq!((nodes[6],nodes[7],nodes[16],nodes[17]),(40.,120.,40.,160.));
        assert_eq!((nodes[8],nodes[9],nodes[18],nodes[19]),(0.,0.,0.,0.));
        assert_eq!(align_main_auto(&mut nodes,&[0.,1.,0.,0.],200.,0.,1,0),0);
        assert_eq!((nodes[7],nodes[17]),(0.,160.));
        assert_eq!(align_main_auto(&mut nodes,&[1.,1.,0.,0.],200.,0.,1,0),0);
        assert_eq!((nodes[7],nodes[17]),(60.,160.));
        assert_eq!(align_main_auto(&mut nodes,&[1.,0.,0.,0.],60.,0.,2,0),0);
        assert_eq!((nodes[7],nodes[17]),(-10.,30.));
        assert_eq!(align_main_auto(&mut nodes,&[f64::NAN,0.,0.,0.],200.,0.,0,0),1);
        assert_eq!(align_main_auto(&mut nodes,&[],200.,0.,0,0),1);
    }

}
