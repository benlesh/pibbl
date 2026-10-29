//! Grid v2 arena. Track expansion, intrinsic bounds and placement are isolated
//! from the legacy explicit-track arena so old ABI consumers remain untouched.
use std::cell::RefCell;
const STRIDE: usize = 7; // kind, value, min kind/value, max kind/value, resolved
#[derive(Default)] struct Grid { generation:u32, alive:bool, columns:Vec<f64>, rows:Vec<f64>, column_contributions:Vec<f64>, row_contributions:Vec<f64>, bounds:[f64;2] }
thread_local! { static GRIDS: RefCell<Vec<Grid>> = const { RefCell::new(Vec::new()) }; }
fn grid_index(handle: u32) -> Option<usize> {
    handle.checked_sub(1).map(|index| index as usize)
}

fn axis_index(axis: u32) -> Option<usize> {
    if axis <= 1 { Some(axis as usize) } else { None }
}

fn valid_cell_coordinate(value: f64) -> bool {
    value.is_finite() && value >= 0.0 && value.fract() == 0.0
}

fn with_grid<R>(handle: u32, generation: u32, invalid: R, f: impl FnOnce(&mut Grid) -> R) -> R {
    GRIDS.with(|pool| {
        let mut pool = pool.borrow_mut();
        let Some(index) = grid_index(handle) else { return invalid; };
        let Some(grid) = pool.get_mut(index) else { return invalid; };
        if !grid.alive || grid.generation != generation { return invalid; }
        f(grid)
    })
}
#[no_mangle] pub extern "C" fn grid_v2_create()->u32 { GRIDS.with(|pool|{let mut p=pool.borrow_mut();for(i,g)in p.iter_mut().enumerate(){if !g.alive {g.alive=true;g.generation=g.generation.saturating_add(1).max(1);return (i+1)as u32}}p.push(Grid{generation:1,alive:true,..Grid::default()});p.len()as u32}) }
#[no_mangle]
pub extern "C" fn grid_v2_generation(handle: u32) -> u32 {
    GRIDS.with(|pool| {
        let pool = pool.borrow();
        grid_index(handle)
            .and_then(|index| pool.get(index))
            .filter(|grid| grid.alive)
            .map_or(0, |grid| grid.generation)
    })
}
#[no_mangle] pub extern "C" fn grid_v2_dispose(h:u32,g:u32)->u32 { let status=with_grid(h,g,1,|v|{v.alive=false;v.columns.clear();v.rows.clear();v.column_contributions.clear();v.row_contributions.clear();0});if status!=0{return status}GRID_CELLS.with(|pool|{if let Some(c)=pool.borrow_mut().get_mut(h.saturating_sub(1)as usize){if c.generation==g{c.alive=false;c.records.clear();c.columns=0;c.rows=0;}}});0 }
#[no_mangle]
pub extern "C" fn grid_v2_resize_tracks(handle: u32, generation: u32, count: usize, axis: u32) -> *mut f64 {
    let Some(axis) = axis_index(axis) else { return std::ptr::null_mut(); };
    with_grid(handle, generation, std::ptr::null_mut(), |grid| {
        let Some(length) = count.checked_mul(STRIDE) else { return std::ptr::null_mut(); };
        let tracks = if axis == 0 { &mut grid.columns } else { &mut grid.rows };
        tracks.resize(length, 0.0);
        tracks.as_mut_ptr()
    })
}
const CONTRIBUTION_STRIDE:usize=4; // start(1), span, min-content, max-content
#[no_mangle]
pub extern "C" fn grid_v2_resize_contributions(handle: u32, generation: u32, count: usize, axis: u32) -> *mut f64 {
    let Some(axis) = axis_index(axis) else { return std::ptr::null_mut(); };
    with_grid(handle, generation, std::ptr::null_mut(), |grid| {
        let Some(length) = count.checked_mul(CONTRIBUTION_STRIDE) else { return std::ptr::null_mut(); };
        let contributions = if axis == 0 { &mut grid.column_contributions } else { &mut grid.row_contributions };
        contributions.resize(length, 0.0);
        contributions.as_mut_ptr()
    })
}
#[no_mangle]
pub extern "C" fn grid_v2_apply_contributions(handle: u32, generation: u32, gap: f64, axis: u32) -> u32 {
    let Some(axis) = axis_index(axis) else { return 1; };
    with_grid(handle, generation, 1, |grid| {
        let (contributions, tracks, bound) = if axis == 0 {
            (&grid.column_contributions, &mut grid.columns, grid.bounds[0])
        } else {
            (&grid.row_contributions, &mut grid.rows, grid.bounds[1])
        };
        if apply_contributions(tracks, contributions, gap, bound)
            .and_then(|_| resolve_tracks(tracks, bound, gap))
            .is_err()
        { 1 } else { 0 }
    })
}
pub(crate) const AUTO_REPEAT_KIND: f64 = 8.0;

/// Expands standalone auto-fill/auto-fit markers using the local finite axis.
/// Marker records are followed by their packed seven-value track pattern:
/// kind 8, mode (1 fill / 2 fit), pattern record count.
pub(crate) fn expand_auto_repeats(records: &[f64], bound: f64, gap: f64) -> Result<(Vec<f64>, Vec<bool>), ()> {
    if !bound.is_finite() || bound < 0.0 || !gap.is_finite() || gap < 0.0 || records.len() % STRIDE != 0 { return Err(()); }
    let mut fixed_breadth = 0.0;
    let mut fixed_tracks = 0usize;
    let mut markers = 0usize;
    let mut scan = 0usize;
    while scan < records.len() / STRIDE {
        let record = &records[scan * STRIDE..(scan + 1) * STRIDE];
        if record[0] != AUTO_REPEAT_KIND {
            fixed_breadth += track_base(record, bound)?;
            fixed_tracks += 1;
            scan += 1;
            continue;
        }
        markers += 1;
        if markers > 1 || !record[2].is_finite() || record[2].fract() != 0.0 || record[2] < 1.0 { return Err(()); }
        scan = scan.checked_add(1 + record[2] as usize).ok_or(())?;
        if scan > records.len() / STRIDE { return Err(()); }
    }
    let mut output = Vec::new();
    let mut auto_fit = Vec::new();
    let mut index = 0usize;
    while index < records.len() / STRIDE {
        let record = &records[index * STRIDE..(index + 1) * STRIDE];
        if record[0] != AUTO_REPEAT_KIND {
            output.extend_from_slice(record);
            auto_fit.push(false);
            index += 1;
            continue;
        }
        if !matches!(record[1] as u32, 1 | 2) || !record[2].is_finite() || record[2].fract() != 0.0 || record[2] < 1.0 { return Err(()); }
        let count = record[2] as usize;
        let start = index.checked_add(1).ok_or(())?;
        let end = start.checked_add(count).ok_or(())?;
        if end > records.len() / STRIDE { return Err(()); }
        let pattern = &records[start * STRIDE..end * STRIDE];
        let mut minimum = 0.0;
        for candidate in pattern.chunks_exact(STRIDE) {
            if candidate[0] == AUTO_REPEAT_KIND { return Err(()); }
            minimum += track_base(candidate, bound)?;
        }
        if !minimum.is_finite() || minimum < 0.0 { return Err(()); }
        // R repeated N-track patterns have R*N-1 inter-track gaps. Fixed
        // tracks before or after the marker also consume their breadth and
        // their adjoining gaps from the local axis.
        let available = bound - fixed_breadth - gap * (fixed_tracks as f64 - 1.0);
        let repeats = (available.max(0.0) / (minimum + count as f64 * gap).max(1.0)).floor() as usize;
        let repeats = repeats.max(1);
        for _ in 0..repeats {
            for candidate in pattern.chunks_exact(STRIDE) {
                output.extend_from_slice(candidate);
                auto_fit.push(record[1] == 2.0);
            }
        }
        index = end;
    }
    Ok((output, auto_fit))
}

/// Collapses unoccupied auto-fit tracks while preserving the assigned cell
/// indexes used by the standalone tree for its remaining layout work.
pub(crate) fn collapse_auto_fit_tracks(records: &mut [f64], auto_fit: &[bool], cells: &[f64], axis: u32) -> Result<(), ()> {
    if axis > 1 || records.len() % STRIDE != 0 || records.len() / STRIDE != auto_fit.len() || cells.len() % CELL_STRIDE != 0 { return Err(()); }
    for track in 0..auto_fit.len() {
        if !auto_fit[track] { continue; }
        let mut occupied = false;
        for cell in cells.chunks_exact(CELL_STRIDE) {
            let slot = if axis == 0 { 0 } else { 2 };
            let start = cell[slot]; let span = cell[slot + 1];
            if !start.is_finite() || !span.is_finite() || start.fract() != 0.0 || span.fract() != 0.0 || start < 1.0 || span < 1.0 { return Err(()); }
            let first = start as usize - 1;
            let end = first.checked_add(span as usize).ok_or(())?;
            if track >= first && track < end { occupied = true; break; }
        }
        if !occupied {
            let record = &mut records[track * STRIDE..(track + 1) * STRIDE];
            record.copy_from_slice(&[0.0, 0.0, 0.0, 0.0, 4.0, 0.0, 0.0]);
        }
    }
    Ok(())
}
pub(crate) fn breadth(kind:f64,value:f64,bound:f64)->Option<f64>{match kind as u32{0=>Some(value),1=>Some(bound*value/100.),3|5=>Some(value),4=>Some(value),_=>None}}
/// Resolve the minimum base without borrowing another track's final allocation.
fn track_base(record: &[f64], bound: f64) -> Result<f64, ()> {
    let value = match record[0] as u32 {
        0 | 1 | 3 | 4 => breadth(record[0], record[1], bound).ok_or(())?,
        2 => 0.0,
        5 | 7 => record[3],
        6 => breadth(record[2], record[3], bound).ok_or(())?,
        _ => return Err(()),
    };
    if value.is_finite() && value >= 0.0 { Ok(value) } else { Err(()) }
}
fn track_fraction(record: &[f64]) -> f64 {
    if record[0] == 2.0 { record[1] }
    else if record[0] == 6.0 && record[4] == 2.0 { record[5] }
    else { 0.0 }
}
fn track_limit(record: &[f64], bound: f64) -> Result<f64, ()> {
    let minimum = track_base(record, bound)?;
    let maximum = match record[0] as u32 {
        5 => record[5].max(minimum),
        7 => record[5].min(record[1]).max(minimum),
        6 if record[4] == 2.0 => minimum,
        6 => breadth(record[4], record[5], bound).ok_or(())?.max(minimum),
        _ => minimum,
    };
    if maximum.is_finite() && maximum >= minimum { Ok(maximum) } else { Err(()) }
}
/// Grow finite minmax/content caps, then solve fractional tracks by freezing
/// tracks whose minimum exceeds their fractional share. No track can consume
/// another track's minimum by adding its floor to an already allocated share.
pub(crate) fn resolve_tracks(records: &mut [f64], bound: f64, gap: f64) -> Result<(), ()> {
    if !bound.is_finite() || bound < 0.0 || !gap.is_finite() || gap < 0.0 || records.len() % STRIDE != 0 { return Err(()); }
    let count = records.len() / STRIDE;
    let mut used = gap * count.saturating_sub(1) as f64;
    for record in records.chunks_exact_mut(STRIDE) {
        let factor = track_fraction(record);
        if !factor.is_finite() || factor < 0.0 { return Err(()); }
        record[6] = track_base(record, bound)?;
        used += record[6];
    }
    if !used.is_finite() { return Err(()); }
    let mut free = (bound - used).max(0.0);
    // Finite growth is shared until a cap freezes; each pass freezes at least
    // one track or consumes the remaining space.
    loop {
        let mut active = 0usize;
        let mut smallest = f64::INFINITY;
        for record in records.chunks_exact(STRIDE) {
            if track_fraction(record) > 0.0 { continue; }
            let room = track_limit(record, bound)? - record[6];
            if room > 0.0 { active += 1; smallest = smallest.min(room); }
        }
        if active == 0 || free <= 0.0 { break; }
        let step = smallest.min(free / active as f64);
        if step <= 0.0 || !step.is_finite() { break; }
        for record in records.chunks_exact_mut(STRIDE) {
            if track_fraction(record) == 0.0 && track_limit(record, bound)? > record[6] { record[6] += step; }
        }
        free = (free - step * active as f64).max(0.0);
    }
    let mut remaining = bound - gap * count.saturating_sub(1) as f64;
    let mut factors = 0.0;
    for record in records.chunks_exact(STRIDE) {
        let factor = track_fraction(record);
        if factor > 0.0 { factors += factor; } else { remaining -= record[6]; }
    }
    // A separate frozen vector belongs to this demanded track solve only.
    let mut frozen = vec![false; count];
    while factors > 0.0 {
        let unit = remaining.max(0.0) / factors.max(1.0);
        let mut changed = false;
        for (index, record) in records.chunks_exact(STRIDE).enumerate() {
            let factor = track_fraction(record);
            if !frozen[index] && factor > 0.0 && record[6] > unit * factor {
                frozen[index] = true; remaining -= record[6]; factors -= factor; changed = true;
            }
        }
        if changed { continue; }
        for (index, record) in records.chunks_exact_mut(STRIDE).enumerate() {
            let factor = track_fraction(record);
            if !frozen[index] && factor > 0.0 { record[6] = (unit * factor).max(record[6]); }
        }
        break;
    }
    Ok(())
}

fn contribution_eligible(record: &[f64], maximum: bool) -> bool {
    if maximum { record[0] == 4.0 || record[0] == 5.0 || record[0] == 7.0 || record[0] == 6.0 && matches!(record[4] as u32, 3 | 4 | 5 | 7) }
    else { matches!(record[0] as u32, 3 | 4 | 5 | 7) || record[0] == 6.0 && matches!(record[2] as u32, 3 | 4 | 5) }
}
fn contribution_value(record: &[f64], maximum: bool, bound: f64) -> Result<f64, ()> {
    if maximum {
        match record[0] as u32 {
            4 => Ok(record[1]), 5 | 7 => Ok(record[5].max(record[3])),
            6 if matches!(record[4] as u32, 3 | 4 | 5 | 7) => Ok(record[5].max(track_base(record, bound)?)),
            _ => track_base(record, bound),
        }
    } else { track_base(record, bound) }
}
fn grow_contribution(record: &mut [f64], maximum: bool, amount: f64, bound: f64) -> Result<(), ()> {
    let current = contribution_value(record, maximum, bound)?;
    let slot = if record[0] == 6.0 { if maximum { 5 } else { 3 } }
        else if record[0] == 5.0 || record[0] == 7.0 { if maximum { 5 } else { 3 } }
        else { 1 };
    record[slot] = current + amount;
    Ok(())
}
/// Contributions are intrinsic data; this routine, rather than the host,
/// distributes deficits across spanning tracks and accounts for internal gaps.
pub(crate) fn apply_contributions(tracks: &mut [f64], contributions: &[f64], gap: f64, bound: f64) -> Result<(), ()> {
    if tracks.len() % STRIDE != 0 || contributions.len() % CONTRIBUTION_STRIDE != 0 || !gap.is_finite() || gap < 0.0 || !bound.is_finite() || bound < 0.0 { return Err(()); }
    let count = tracks.len() / STRIDE;
    let mut order: Vec<usize> = (0..contributions.len() / CONTRIBUTION_STRIDE).collect();
    order.sort_by(|a,b| contributions[a * CONTRIBUTION_STRIDE + 1].total_cmp(&contributions[b * CONTRIBUTION_STRIDE + 1]));
    for index in order {
        let input = &contributions[index * CONTRIBUTION_STRIDE..index * CONTRIBUTION_STRIDE + CONTRIBUTION_STRIDE];
        if !input[0].is_finite() || !input[1].is_finite() || input[0].fract() != 0.0 || input[1].fract() != 0.0 || input[0] < 1.0 || input[1] < 1.0 || !input[2].is_finite() || !input[3].is_finite() || input[2] < 0.0 || input[3] < input[2] { return Err(()); }
        let start = input[0] as usize - 1; let span = input[1] as usize;
        if start.checked_add(span).is_none_or(|end| end > count) { return Err(()); }
        for pass in 0..2 {
            let maximum = pass == 1;
            let mut used = gap * span.saturating_sub(1) as f64;
            let mut eligible = 0usize;
            for record in tracks[start * STRIDE..(start + span) * STRIDE].chunks_exact(STRIDE) {
                used += contribution_value(record, maximum, bound)?;
                if contribution_eligible(record, maximum) { eligible += 1; }
            }
            let deficit = (input[2 + pass] - used).max(0.0);
            if eligible > 0 && deficit > 0.0 {
                let share = deficit / eligible as f64;
                for record in tracks[start * STRIDE..(start + span) * STRIDE].chunks_exact_mut(STRIDE) {
                    if contribution_eligible(record, maximum) { grow_contribution(record, maximum, share, bound)?; }
                }
            }
        }
    }
    Ok(())
}

#[no_mangle] pub extern "C" fn grid_v2_resolve_tracks(h:u32,g:u32,bound:f64,gap:f64,axis:u32)->u32 { with_grid(h,g,1,|v|{if axis>1{return 1}v.bounds[axis as usize]=bound;let a=if axis==0{&mut v.columns}else{&mut v.rows};if resolve_tracks(a,bound,gap).is_err(){1}else{0}}) }
// v2 cell records: column start/span, row start/span, output x/y/width/height.
const CELL_STRIDE:usize=8;
#[derive(Default)] struct Cells { generation:u32, alive:bool, records:Vec<f64>, columns:usize, rows:usize, column_keep:Vec<u32>, row_keep:Vec<u32> }
thread_local! { static GRID_CELLS: RefCell<Vec<Cells>> = const { RefCell::new(Vec::new()) }; }

/// Releases all standalone Grid arenas when the shared module is disposed.
pub(crate) fn dispose_all_grids() {
    GRIDS.with(|pool| pool.borrow_mut().clear());
    GRID_CELLS.with(|pool| pool.borrow_mut().clear());
}
#[no_mangle] pub extern "C" fn grid_v2_resize_cells(h:u32,g:u32,count:usize)->*mut f64 {
    if h == 0 { return std::ptr::null_mut(); }
    let valid = GRIDS.with(|pool| pool.borrow().get(h as usize - 1).is_some_and(|grid| grid.alive && grid.generation == g));
    if !valid { return std::ptr::null_mut(); }
    GRID_CELLS.with(|pool| {
        let mut pool = pool.borrow_mut(); let index = h as usize - 1;
        if pool.len() <= index { pool.resize_with(index + 1, Cells::default); }
        let cells = &mut pool[index];
        if !cells.alive { cells.alive = true; cells.generation = g; }
        if cells.generation != g { return std::ptr::null_mut(); }
        let Some(length) = count.checked_mul(CELL_STRIDE) else { return std::ptr::null_mut(); };
        cells.records.resize(length, 0.0); cells.records.as_mut_ptr()
    })
}
#[no_mangle] pub extern "C" fn grid_v2_place_cells(h:u32,g:u32,cols:*const f64,col_count:usize,rows:*const f64,row_count:usize,column_gap:f64,row_gap:f64)->u32 {
    if h == 0 || cols.is_null() || rows.is_null() || !column_gap.is_finite() || column_gap < 0.0 || !row_gap.is_finite() || row_gap < 0.0 { return 1; }
    GRIDS.with(|grids| {
        let grids = grids.borrow(); let Some(grid) = grids.get(h as usize - 1) else { return 1 };
        if !grid.alive || grid.generation != g || col_count != grid.columns.len() / STRIDE || row_count != grid.rows.len() / STRIDE || cols != grid.columns.as_ptr() || rows != grid.rows.as_ptr() { return 1; }
        GRID_CELLS.with(|pool| {
            let mut pool = pool.borrow_mut(); let Some(cells) = pool.get_mut(h as usize - 1) else { return 1 };
            if !cells.alive || cells.generation != g { return 1; }
            for record in cells.records.chunks_exact_mut(CELL_STRIDE) {
                if !valid_cell_coordinate(record[0]) || !valid_cell_coordinate(record[1]) ||
                    !valid_cell_coordinate(record[2]) || !valid_cell_coordinate(record[3])
                { return 1; }
                let cs = record[0] as usize; let cn = record[1] as usize;
                let rs = record[2] as usize; let rn = record[3] as usize;
                if cs == 0 || rs == 0 || cn == 0 || rn == 0 ||
                    cs.checked_add(cn).is_none_or(|end| end - 1 > col_count) ||
                    rs.checked_add(rn).is_none_or(|end| end - 1 > row_count)
                { return 1; }
                let mut x = 0.0; for index in 0..cs - 1 { x += grid.columns[index * STRIDE + 6] + column_gap; }
                let mut y = 0.0; for index in 0..rs - 1 { y += grid.rows[index * STRIDE + 6] + row_gap; }
                let mut width = 0.0; for index in cs - 1..cs - 1 + cn { width += grid.columns[index * STRIDE + 6]; } width += column_gap * (cn.saturating_sub(1) as f64);
                let mut height = 0.0; for index in rs - 1..rs - 1 + rn { height += grid.rows[index * STRIDE + 6]; } height += row_gap * (rn.saturating_sub(1) as f64);
                if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() { return 1; }
                record[4] = x; record[5] = y; record[6] = width; record[7] = height;
            }
            0
        })
    })
}
#[no_mangle]
pub extern "C" fn grid_v2_assigned_columns(handle: u32, generation: u32) -> usize {
    GRID_CELLS.with(|pool| {
        let pool = pool.borrow();
        grid_index(handle)
            .and_then(|index| pool.get(index))
            .filter(|cells| cells.alive && cells.generation == generation)
            .map_or(0, |cells| cells.columns)
    })
}

#[no_mangle]
pub extern "C" fn grid_v2_collapse_auto_fit(handle: u32, generation: u32, axis: u32, explicit: usize) -> u32 {
    let Some(axis) = axis_index(axis) else { return 1; };
    let Some(index) = grid_index(handle) else { return 1; };
    GRID_CELLS.with(|pool| {
        let mut pool = pool.borrow_mut();
        let Some(cells) = pool.get_mut(index) else { return 1; };
        if !cells.alive || cells.generation != generation { return 1; }
        let count = if axis == 0 { cells.columns } else { cells.rows };
        let mut keep = vec![0u32; count];
        for track in 0..explicit.min(count) { keep[track] = 1; }
        for record in cells.records.chunks_exact(CELL_STRIDE) {
            let (start, span) = if axis == 0 { (record[0], record[1]) } else { (record[2], record[3]) };
            if !valid_cell_coordinate(start) || !valid_cell_coordinate(span) { return 1; }
            let start = start as usize;
            let span = span as usize;
            for track in start.saturating_sub(1)..start.saturating_sub(1).saturating_add(span) {
                if track < count { keep[track] = 1; }
            }
        }
        let mut map = vec![0usize; count];
        let mut next = 0usize;
        for track in 0..count {
            if keep[track] != 0 { map[track] = next; next += 1; }
        }
        for record in cells.records.chunks_exact_mut(CELL_STRIDE) {
            let slot = if axis == 0 { 0 } else { 2 };
            let start = record[slot] as usize;
            if start > 0 && start - 1 < count { record[slot] = (map[start - 1] + 1) as f64; }
        }
        if axis == 0 { cells.column_keep = keep; cells.columns = next; }
        else { cells.row_keep = keep; cells.rows = next; }
        0
    })
}

#[no_mangle]
pub extern "C" fn grid_v2_auto_fit_keep(handle: u32, generation: u32, index: usize, axis: u32) -> u32 {
    let Some(axis) = axis_index(axis) else { return 0; };
    GRID_CELLS.with(|pool| {
        let pool = pool.borrow();
        grid_index(handle)
            .and_then(|slot| pool.get(slot))
            .filter(|cells| cells.alive && cells.generation == generation)
            .and_then(|cells| if axis == 0 { cells.column_keep.get(index) } else { cells.row_keep.get(index) })
            .copied()
            .unwrap_or(0)
    })
}

#[no_mangle]
pub extern "C" fn grid_v2_assigned_rows(handle: u32, generation: u32) -> usize {
    GRID_CELLS.with(|pool| {
        let pool = pool.borrow();
        grid_index(handle)
            .and_then(|index| pool.get(index))
            .filter(|cells| cells.alive && cells.generation == generation)
            .map_or(0, |cells| cells.rows)
    })
}
/// Assigns explicit and automatic cells in source order. Records use the v2
/// cell layout: column start/span, row start/span, then output geometry.
/// Kept public to sibling native owners so standalone trees share exactly the
/// same sparse/dense and implicit-track policy as mounted Grid.
pub(crate) fn assign_cells(records: &mut [f64], columns: usize, rows: usize, flow: u32) -> Result<(usize, usize), ()> {
    if records.len() % CELL_STRIDE != 0 || flow > 3 { return Err(()); }
    let (mut cols, mut row_count) = (columns.max(1), rows.max(1));
    for record in records.chunks_exact(CELL_STRIDE) {
        if !valid_cell_coordinate(record[0]) || !valid_cell_coordinate(record[1]) ||
            !valid_cell_coordinate(record[2]) || !valid_cell_coordinate(record[3])
        { return Err(()); }
        if record[0] > 0.0 { cols = cols.max(record[0] as usize + record[1].max(1.0) as usize - 1); }
        if record[2] > 0.0 { row_count = row_count.max(record[2] as usize + record[3].max(1.0) as usize - 1); }
    }
    let mut used = vec![false; cols.checked_mul(row_count).ok_or(())?];
    let (mut cursor_x, mut cursor_y) = (0usize, 0usize);
    let by_column = flow & 1 != 0;
    let dense = flow & 2 != 0;
    for record in records.chunks_exact_mut(CELL_STRIDE) {
        let cs = record[0] as usize; let rs = record[2] as usize;
        let cn = record[1].max(1.0) as usize; let rn = record[3].max(1.0) as usize;
        let (mut x, mut y) = (cs.saturating_sub(1), rs.saturating_sub(1));
        if cs > 0 && rs == 0 {
            // An explicit column keeps its logical column while automatic flow
            // finds or creates a row that can contain its requested span.
            let mut found = false;
            while !found {
                for yy in 0..row_count { if x + cn <= cols && yy + rn <= row_count && (yy..yy + rn).all(|iy| (x..x + cn).all(|ix| !used[iy * cols + ix])) { y = yy; found = true; break; } }
                if !found { row_count += 1; used.resize(cols.checked_mul(row_count).ok_or(())?, false); }
            }
            record[2] = (y + 1) as f64;
        } else if rs > 0 && cs == 0 {
            // Symmetric explicit-row handling preserves row placement while
            // automatic flow finds or creates a compatible column.
            let mut found = false;
            while !found {
                for xx in 0..cols { if xx + cn <= cols && y + rn <= row_count && (y..y + rn).all(|iy| (xx..xx + cn).all(|ix| !used[iy * cols + ix])) { x = xx; found = true; break; } }
                if !found { let old = cols; cols += 1; let mut next = vec![false; cols.checked_mul(row_count).ok_or(())?]; for yy in 0..row_count { for xx in 0..old { next[yy * cols + xx] = used[yy * old + xx]; } } used = next; }
            }
            record[0] = (x + 1) as f64;
        } else if cs == 0 && rs == 0 {
            let mut found = false;
            while !found {
                let (sx, sy) = if dense { (0, 0) } else { (cursor_x, cursor_y) };
                if by_column {
                    for xx in sx..cols { for yy in if xx == sx { sy } else { 0 }..row_count {
                        if xx + cn <= cols && yy + rn <= row_count && (yy..yy + rn).all(|iy| (xx..xx + cn).all(|ix| !used[iy * cols + ix])) { x = xx; y = yy; found = true; break; }
                    } if found { break; } }
                    if !found { let old = cols; cols += 1; let mut next = vec![false; cols.checked_mul(row_count).ok_or(())?]; for yy in 0..row_count { for xx in 0..old { next[yy * cols + xx] = used[yy * old + xx]; } } used = next; }
                } else {
                    for yy in sy..row_count { for xx in if yy == sy { sx } else { 0 }..cols {
                        if xx + cn <= cols && yy + rn <= row_count && (yy..yy + rn).all(|iy| (xx..xx + cn).all(|ix| !used[iy * cols + ix])) { x = xx; y = yy; found = true; break; }
                    } if found { break; } }
                    if !found { row_count += 1; used.resize(cols.checked_mul(row_count).ok_or(())?, false); }
                }
            }
            record[0] = (x + 1) as f64; record[2] = (y + 1) as f64;
        }
        for iy in y..y + rn { for ix in x..x + cn { if ix >= cols || iy >= row_count { return Err(()); } used[iy * cols + ix] = true; } }
        if !dense { if by_column { cursor_x = x; cursor_y = y + rn; if cursor_y >= row_count { cursor_x += 1; cursor_y = 0; } } else { cursor_y = y; cursor_x = x + cn; if cursor_x >= cols { cursor_y += 1; cursor_x = 0; } } }
    }
    Ok((cols, row_count))
}

#[cfg(test)]
mod grid_v2_tests {
  use super::*;
  #[test] fn contribution_removes_internal_gap_and_fixed_breadth() {
    let mut tracks=[0.,20.,0.,0.,0.,0.,20., 3.,0.,0.,0.,0.,0.,0.];
    apply_contributions(&mut tracks,&[1.,2.,50.,80.],10.,100.).unwrap();
    resolve_tracks(&mut tracks,100.,10.).unwrap();
    assert_eq!(tracks[13],20.);
  }
  #[test] fn assignment_preserves_one_explicit_axis_while_finding_the_other() {
    // The first item pins its column and gains a row; the second does the
    // symmetric operation. Standalone Grid calls this shared policy directly.
    let mut records = [
      2.,1.,0.,1.,0.,0.,0.,0.,
      0.,1.,2.,1.,0.,0.,0.,0.,
    ];
    let (columns, rows) = assign_cells(&mut records, 2, 2, 0).unwrap();
    assert_eq!((columns, rows), (2, 2));
    assert_eq!((records[0], records[2]), (2., 1.));
    assert_eq!((records[8], records[10]), (1., 2.));
  }
  #[test] fn auto_repeat_includes_all_inter_track_gaps() {
    let records = [AUTO_REPEAT_KIND, 1., 1., 0., 0., 0., 0., 0., 20., 0., 0., 0., 0., 0.];
    let (expanded, auto_fit) = expand_auto_repeats(&records, 100., 5.).unwrap();
    assert_eq!(expanded.len() / STRIDE, 4);
    assert_eq!(auto_fit, vec![false; 4]);
  }
  #[test] fn cell_ffi_rejects_zero_or_foreign_handles_and_unowned_track_pointers() {
    assert!(grid_v2_resize_cells(0, 1, 1).is_null());
    let handle = grid_v2_create(); let generation = grid_v2_generation(handle);
    assert!(grid_v2_resize_cells(handle + 1, generation, 1).is_null());
    let cells = grid_v2_resize_cells(handle, generation, 1); assert!(!cells.is_null());
    unsafe { std::slice::from_raw_parts_mut(cells, CELL_STRIDE).copy_from_slice(&[1.,1.,1.,1.,0.,0.,0.,0.]); }
    let columns = grid_v2_resize_tracks(handle, generation, 1, 0); let rows = grid_v2_resize_tracks(handle, generation, 1, 1);
    unsafe { std::slice::from_raw_parts_mut(columns, STRIDE).copy_from_slice(&[0.,20.,0.,0.,4.,20.,20.]); std::slice::from_raw_parts_mut(rows, STRIDE).copy_from_slice(&[0.,10.,0.,0.,4.,10.,10.]); }
    assert_eq!(grid_v2_place_cells(handle, generation, 1usize as *const f64, 1, rows, 1, 0., 0.), 1);
    assert_eq!(grid_v2_place_cells(handle, generation, columns, 1, rows, 1, 0., 0.), 0);
    assert_eq!(grid_v2_dispose(handle, generation), 0);
  }
  #[test] fn ffi_rejects_invalid_handles_axes_and_cell_coordinates() {
    assert_eq!(grid_v2_generation(0), 0);
    assert!(grid_v2_resize_tracks(0, 1, 1, 0).is_null());
    assert!(grid_v2_resize_contributions(0, 1, 1, 0).is_null());
    assert_eq!(grid_v2_assigned_columns(0, 1), 0);
    assert_eq!(grid_v2_assigned_rows(0, 1), 0);
    assert_eq!(grid_v2_collapse_auto_fit(0, 1, 0, 0), 1);
    assert_eq!(grid_v2_auto_fit_keep(0, 1, 0, 0), 0);
    assert_eq!(grid_v2_assign_cells(0, 1, 1, 1, 0), 1);

    let handle = grid_v2_create();
    let generation = grid_v2_generation(handle);
    for axis in [2, u32::MAX] {
      assert!(grid_v2_resize_tracks(handle, generation, 1, axis).is_null());
      assert!(grid_v2_resize_contributions(handle, generation, 1, axis).is_null());
      assert_eq!(grid_v2_apply_contributions(handle, generation, 0., axis), 1);
      assert_eq!(grid_v2_collapse_auto_fit(handle, generation, axis, 0), 1);
      assert_eq!(grid_v2_auto_fit_keep(handle, generation, 0, axis), 0);
    }

    let columns = grid_v2_resize_tracks(handle, generation, 1, 0);
    let rows = grid_v2_resize_tracks(handle, generation, 1, 1);
    unsafe {
      std::slice::from_raw_parts_mut(columns, STRIDE)
        .copy_from_slice(&[0., 20., 0., 0., 4., 20., 20.]);
      std::slice::from_raw_parts_mut(rows, STRIDE)
        .copy_from_slice(&[0., 10., 0., 0., 4., 10., 10.]);
    }
    let cells = grid_v2_resize_cells(handle, generation, 1);
    for invalid in [f64::NAN, f64::INFINITY, 1.5] {
      unsafe {
        std::slice::from_raw_parts_mut(cells, CELL_STRIDE)
          .copy_from_slice(&[invalid, 1., 1., 1., 0., 0., 0., 0.]);
      }
      assert_eq!(grid_v2_place_cells(handle, generation, columns, 1, rows, 1, 0., 0.), 1);
      assert_eq!(grid_v2_assign_cells(handle, generation, 1, 1, 0), 1);
    }
    assert_eq!(grid_v2_dispose(handle, generation), 0);
  }
  #[test] fn auto_fit_zeros_only_unoccupied_expanded_tracks() {
    let records = [AUTO_REPEAT_KIND, 2., 1., 0., 0., 0., 0., 0., 20., 0., 0., 0., 0., 0.];
    let (mut expanded, flags) = expand_auto_repeats(&records, 100., 5.).unwrap();
    let cells = [1., 1., 1., 1., 0., 0., 0., 0.];
    collapse_auto_fit_tracks(&mut expanded, &flags, &cells, 0).unwrap();
    resolve_tracks(&mut expanded, 100., 5.).unwrap();
    assert_eq!(expanded[6], 20.);
    assert_eq!((expanded[13], expanded[20], expanded[27]), (0., 0., 0.));
  }
}
#[no_mangle]
pub extern "C" fn grid_v2_assign_cells(handle: u32, generation: u32, columns: usize, rows: usize, flow: u32) -> u32 {
    let Some(index) = grid_index(handle) else { return 1; };
    GRID_CELLS.with(|pool| {
        let mut pool = pool.borrow_mut();
        let Some(cells) = pool.get_mut(index) else { return 1; };
        if !cells.alive || cells.generation != generation { return 1; }
        match assign_cells(&mut cells.records, columns, rows, flow) {
            Ok((columns, rows)) => { cells.columns = columns; cells.rows = rows; 0 }
            Err(()) => 1,
        }
    })
}

#[cfg(test)]
mod grid_track_resolution_tests {
    use super::*;
    #[test]
    fn finite_caps_saturate_before_fractional_space() {
        let mut tracks = vec![6.,0.,0.,20.,0.,60.,0., 2.,1.,0.,0.,0.,0.,0.];
        resolve_tracks(&mut tracks,200.,0.).unwrap();
        assert_eq!((tracks[6],tracks[13]),(60.,140.));
    }
    #[test]
    fn fractional_minima_freeze_before_recomputing_other_shares() {
        let mut tracks = vec![6.,0.,0.,80.,2.,1.,0., 2.,3.,0.,0.,0.,0.,0.];
        resolve_tracks(&mut tracks,100.,0.).unwrap();
        assert_eq!((tracks[6],tracks[13]),(80.,20.));
    }
    #[test]
    fn fit_content_floor_can_exceed_the_cap_and_maximum_growth_is_bounded() {
        let mut tracks = vec![7.,40.,0.,0.,0.,0.,0., 2.,1.,0.,0.,0.,0.,0.];
        apply_contributions(&mut tracks,&[1.,1.,20.,100.],0.,200.).unwrap();
        resolve_tracks(&mut tracks,200.,0.).unwrap();
        assert_eq!((tracks[6],tracks[13]),(40.,160.));
        tracks[3]=60.;
        resolve_tracks(&mut tracks,200.,0.).unwrap();
        assert_eq!((tracks[6],tracks[13]),(60.,140.));
    }
}
