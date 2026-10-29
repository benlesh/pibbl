//! Persistent, renderer-neutral tree state for `@pibbl/layout`.
//!
//! This module deliberately owns only normalized numeric graph data. The host
//! converts public styles once and owns synchronous measurement callback dispatch;
//! no Canvas, JavaScript object, or scheduler reference can enter this structure.

use super::{allocate, align_main, form_lines, grid::{apply_contributions, assign_cells, collapse_auto_fit_tracks, expand_auto_repeats, resolve_tracks}, Arena, STRIDE};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum TreeAxis { Row, Column }

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TreePadding { pub left: f64, pub right: f64, pub top: f64, pub bottom: f64, pub left_percent: bool, pub right_percent: bool, pub top_percent: bool, pub bottom_percent: bool }

impl TreePadding {
    fn resolve(self, width: f64) -> Result<(f64, f64, f64, f64), u32> {
        let resolve = |value: f64, percent: bool| if percent { width * value / 100.0 } else { value };
        let left = resolve(self.left, self.left_percent); let right = resolve(self.right, self.right_percent);
        let top = resolve(self.top, self.top_percent); let bottom = resolve(self.bottom, self.bottom_percent);
        if left.is_finite() && right.is_finite() && top.is_finite() && bottom.is_finite() && left >= 0.0 && right >= 0.0 && top >= 0.0 && bottom >= 0.0 { Ok((left, right, top, bottom)) } else { Err(1) }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TreeStyle {
    pub width: Option<f64>, pub height: Option<f64>,
    pub width_percent: bool, pub height_percent: bool,
    pub min_width: f64, pub min_height: f64, pub max_width: f64, pub max_height: f64,
    pub min_width_percent: bool, pub min_height_percent: bool,
    pub max_width_percent: bool, pub max_height_percent: bool,
    pub basis: Option<f64>, pub basis_percent: bool, pub grow: f64, pub shrink: f64, pub gap: f64, pub row_gap: f64, pub column_gap: f64,
    pub axis: TreeAxis, pub reverse: bool, pub wrap: u32, pub justify: u32, pub align_items: u32, pub align_self: u32, pub align_content: u32,
    pub margin_left: f64, pub margin_right: f64, pub margin_top: f64, pub margin_bottom: f64,
    pub padding: TreePadding, pub border_left: f64, pub border_right: f64, pub border_top: f64, pub border_bottom: f64,
    pub position: u32, pub box_sizing: u32, pub aspect_ratio: f64,
    pub left: Option<f64>, pub right: Option<f64>, pub top: Option<f64>, pub bottom: Option<f64>,
    pub left_percent: bool, pub right_percent: bool, pub top_percent: bool, pub bottom_percent: bool,
}

impl TreeStyle {
    pub(crate) fn validate(self) -> Result<Self, u32> {
        let finite_nonnegative = |value: f64| value.is_finite() && value >= 0.0;
        if self.width.is_some_and(|value| !finite_nonnegative(value))
            || self.height.is_some_and(|value| !finite_nonnegative(value))
            || !finite_nonnegative(self.min_width) || !finite_nonnegative(self.min_height)
            || (!self.max_width.is_infinite() && !finite_nonnegative(self.max_width))
            || (!self.max_height.is_infinite() && !finite_nonnegative(self.max_height))
            || (!self.min_width_percent && !self.max_width_percent && self.min_width > self.max_width)
            || (!self.min_height_percent && !self.max_height_percent && self.min_height > self.max_height)
            || self.basis.is_some_and(|value| !finite_nonnegative(value))
            || !finite_nonnegative(self.grow) || !finite_nonnegative(self.shrink) || !finite_nonnegative(self.gap) || (!self.row_gap.is_finite() || self.row_gap < -1.0) || (!self.column_gap.is_finite() || self.column_gap < -1.0)
            || self.wrap > 2 || self.justify > 5 || self.align_items > 6 || self.align_self > 7 || self.align_content > 6 || self.position > 2 || self.box_sizing > 1
            || !self.aspect_ratio.is_finite() || self.aspect_ratio < 0.0
            || !self.margin_left.is_finite() || !self.margin_right.is_finite() || !self.margin_top.is_finite() || !self.margin_bottom.is_finite()
            || !self.padding.left.is_finite() || !self.padding.right.is_finite() || !self.padding.top.is_finite() || !self.padding.bottom.is_finite()
            || self.padding.left < 0.0 || self.padding.right < 0.0 || self.padding.top < 0.0 || self.padding.bottom < 0.0
            || !finite_nonnegative(self.border_left) || !finite_nonnegative(self.border_right) || !finite_nonnegative(self.border_top) || !finite_nonnegative(self.border_bottom)
        { return Err(1); }
        Ok(self)
    }

    fn resolve_for_owner(mut self, width: f64, height: f64, parent_axis: Option<TreeAxis>) -> Result<Self, u32> {
        let resolve = |value: f64, percent: bool, owner: f64| {
            if percent { owner * value / 100.0 } else { value }
        };
        if !width.is_finite() || width < 0.0 || !height.is_finite() || height < 0.0 { return Err(2); }
        self.width = self.width.map(|value| resolve(value, self.width_percent, width));
        self.height = self.height.map(|value| resolve(value, self.height_percent, height));
        self.min_width = resolve(self.min_width, self.min_width_percent, width);
        self.min_height = resolve(self.min_height, self.min_height_percent, height);
        self.max_width = resolve(self.max_width, self.max_width_percent, width);
        self.max_height = resolve(self.max_height, self.max_height_percent, height);
        let main_owner = if parent_axis.unwrap_or(self.axis) == TreeAxis::Row { width } else { height };
        self.basis = self.basis.map(|value| resolve(value, self.basis_percent, main_owner));
        self.width_percent = false; self.height_percent = false;
        self.min_width_percent = false; self.min_height_percent = false;
        self.max_width_percent = false; self.max_height_percent = false;
        self.basis_percent = false;
        self.left = self.left.map(|value| resolve(value, self.left_percent, width));
        self.right = self.right.map(|value| resolve(value, self.right_percent, width));
        self.top = self.top.map(|value| resolve(value, self.top_percent, height));
        self.bottom = self.bottom.map(|value| resolve(value, self.bottom_percent, height));
        self.left_percent = false; self.right_percent = false; self.top_percent = false; self.bottom_percent = false;
        if self.box_sizing == 1 {
            let (left, right, top, bottom) = self.padding.resolve(width)?;
            let horizontal = left + right + self.border_left + self.border_right;
            let vertical = top + bottom + self.border_top + self.border_bottom;
            self.width = self.width.map(|value| value + horizontal);
            self.height = self.height.map(|value| value + vertical);
            self.min_width += horizontal; self.min_height += vertical;
            self.max_width += horizontal; self.max_height += vertical;
            self.basis = self.basis.map(|value| value + if parent_axis.unwrap_or(self.axis) == TreeAxis::Row { horizontal } else { vertical });
            self.box_sizing = 0;
        }
        self.validate()
    }
}

#[derive(Clone, Debug)]
pub(crate) struct TreeGrid { pub(crate) columns: Vec<f64>, pub(crate) rows: Vec<f64>, pub(crate) auto_column: Option<[f64; 7]>, pub(crate) auto_row: Option<[f64; 7]>, pub(crate) flow: u32, pub(crate) column_gap: f64, pub(crate) row_gap: f64 }
#[derive(Clone, Copy, Debug)]
pub(crate) struct TreeGridPlacement { pub(crate) column_start: usize, pub(crate) column_span: usize, pub(crate) row_start: usize, pub(crate) row_span: usize }

#[derive(Clone, Debug)]
pub(crate) struct TreeNode {
    pub(crate) id: u32,
    pub(crate) parent: Option<u32>,
    pub(crate) children: Vec<u32>,
    pub(crate) style: TreeStyle,
    /// Host-owned measurement key. Native code only returns a request and never
    /// retains or invokes the JavaScript callback.
    pub(crate) measure_key: Option<u32>,
    pub(crate) intrinsic_key: Option<u32>,
    pub(crate) grid: Option<TreeGrid>,
    pub(crate) grid_placement: TreeGridPlacement,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TreeBox { pub(crate) x: f64, pub(crate) y: f64, pub(crate) width: f64, pub(crate) height: f64 }
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TreeMeasureRequest { pub(crate) node: u32, pub(crate) kind: u32, pub(crate) width: f64, pub(crate) height: f64 }

#[derive(Default)]
pub(crate) struct StandaloneTree {
    generation: u32,
    nodes: Vec<TreeNode>,
    boxes: Vec<TreeBox>,
    arena: Arena,
    dirty: bool,
}

impl StandaloneTree {
    pub(crate) fn replace(&mut self, generation: u32, nodes: Vec<TreeNode>) -> Result<(), u32> {
        if generation == 0 || nodes.is_empty() { return Err(1); }
        for (index, node) in nodes.iter().enumerate() {
            if node.id as usize != index || node.style.validate().is_err() { return Err(1); }
            if node.parent.is_some_and(|parent| parent as usize >= nodes.len()) { return Err(1); }
            for &child in &node.children {
                if child as usize >= nodes.len() || nodes[child as usize].parent != Some(node.id) { return Err(1); }
            }
        }
        self.generation = generation;
        self.nodes = nodes;
        self.boxes = vec![TreeBox { x: f64::NAN, y: f64::NAN, width: f64::NAN, height: f64::NAN }; self.nodes.len()];
        self.arena = Arena::default();
        self.dirty = true;
        Ok(())
    }

    /// First phase: returns explicit callback envelopes before mutating geometry.
    /// A host must either resume every request with finite dimensions or discard
    /// this tree calculation; it must never reuse a prior callback result by key.
    pub(crate) fn prepare(&self, root: u32, width: f64, height: f64) -> Result<Vec<TreeMeasureRequest>, u32> {
        if root as usize >= self.nodes.len() || !width.is_finite() || width < 0.0 || !height.is_finite() || height < 0.0 { return Err(1); }
        let mut requests = Vec::new();
        self.collect_measure_requests(root, width, height, &mut requests)?;
        Ok(requests)
    }

    /// Requests a single bounded continuation after a complete native solve.
    /// The first pass owns main-axis allocation; the second pass receives those
    /// exact boxes and can only change natural/cross contributions before the
    /// final native placement pass.  There is no iterative feedback loop.
    pub(crate) fn prepare_settled_measurements(&self) -> Result<Vec<TreeMeasureRequest>, u32> {
        let mut requests = Vec::new();
        for node in &self.nodes {
            let box_ = self.box_for(node.id).ok_or(1u32)?;
            let (width, height) = match node.parent.and_then(|id| self.nodes.get(id as usize)) {
                Some(parent) if parent.style.axis == TreeAxis::Row => (box_.width, self.box_for(parent.id).ok_or(1u32)?.height),
                Some(parent) => (self.box_for(parent.id).ok_or(1u32)?.width, box_.height),
                None => (box_.width, box_.height),
            };
            if node.measure_key.is_some() { requests.push(TreeMeasureRequest { node: node.id, kind: 0, width, height }); }
            if node.intrinsic_key.is_some() { requests.push(TreeMeasureRequest { node: node.id, kind: 1, width, height }); }
        }
        Ok(requests)
    }

    pub(crate) fn solve(&mut self, root: u32, width: f64, height: f64, rtl: bool, measured: &[(u32, f64, f64, f64, f64, f64, f64)]) -> Result<&[TreeBox], u32> {
        if root as usize >= self.nodes.len() || !width.is_finite() || width < 0.0 || !height.is_finite() || height < 0.0 { return Err(1); }
        let mut results = vec![None; self.nodes.len()]; let mut intrinsic = vec![None; self.nodes.len()];
        for &(id, measured_width, measured_height, min_width, max_width, min_height, max_height) in measured {
            if id as usize >= results.len() { return Err(1); }
            if measured_width.is_finite() || measured_height.is_finite() { if !measured_width.is_finite() || measured_width < 0.0 || !measured_height.is_finite() || measured_height < 0.0 || results[id as usize].replace((measured_width, measured_height)).is_some() { return Err(1); } }
            if min_width.is_finite() || max_width.is_finite() || min_height.is_finite() || max_height.is_finite() { if !min_width.is_finite() || !max_width.is_finite() || !min_height.is_finite() || !max_height.is_finite() || min_width < 0.0 || min_height < 0.0 || min_width > max_width || min_height > max_height || intrinsic[id as usize].replace((min_width, max_width, min_height, max_height)).is_some() { return Err(1); } }
        }
        for node in &self.nodes { if node.measure_key.is_some() && results[node.id as usize].is_none() { return Err(1); } if node.intrinsic_key.is_some() && intrinsic[node.id as usize].is_none() { return Err(1); } }
        self.solve_node(root, 0.0, 0.0, width, height, width, height, rtl, &results, &intrinsic, None)?;
        self.dirty = false;
        Ok(&self.boxes)
    }

    pub(crate) fn generation(&self) -> u32 { self.generation }
    pub(crate) fn box_for(&self, node: u32) -> Option<TreeBox> { self.boxes.get(node as usize).copied().filter(|box_| box_.x.is_finite() && box_.y.is_finite()) }

    fn collect_measure_requests(&self, id: u32, width: f64, height: f64, requests: &mut Vec<TreeMeasureRequest>) -> Result<(), u32> {
        let node = self.nodes.get(id as usize).ok_or(1u32)?;
        let style = node.style.resolve_for_owner(width, height, node.parent.and_then(|parent| self.nodes.get(parent as usize)).map(|parent| parent.style.axis))?;
        let own_width = style.width.unwrap_or(width).clamp(style.min_width, style.max_width);
        let own_height = style.height.unwrap_or(height).clamp(style.min_height, style.max_height);
        let (left, right, top, bottom) = style.padding.resolve(own_width)?;
        let content_width = (own_width - left - right).max(0.0);
        let content_height = (own_height - top - bottom).max(0.0);
        if node.measure_key.is_some() { requests.push(TreeMeasureRequest { node: id, kind: 0, width: content_width, height: content_height }); }
        if node.intrinsic_key.is_some() { requests.push(TreeMeasureRequest { node: id, kind: 1, width: content_width, height: content_height }); }
        for &child in &node.children {
            self.collect_measure_requests(child, content_width, content_height, requests)?;
        }
        Ok(())
    }

    fn solve_node(&mut self, id: u32, x: f64, y: f64, width: f64, height: f64, owner_width: f64, owner_height: f64, rtl: bool, measured: &[Option<(f64, f64)>], intrinsic: &[Option<(f64, f64, f64, f64)>], containing: Option<TreeBox>) -> Result<(), u32> {
        let mut node = self.nodes.get(id as usize).ok_or(1u32)?.clone();
        let parent_axis = node.parent
            .and_then(|parent| self.nodes.get(parent as usize))
            .map(|parent| parent.style.axis);
        node.style = node.style.resolve_for_owner(owner_width, owner_height, parent_axis)?;
        let (x, y) = if node.style.position == 0 {
            (x + if rtl { node.style.right.map(|value| -value).or(node.style.left).unwrap_or(0.0) } else { node.style.left.or(node.style.right.map(|value| -value)).unwrap_or(0.0) },
             y + node.style.top.or(node.style.bottom.map(|value| -value)).unwrap_or(0.0))
        } else { (x, y) };
        // Measurement supplies the Flex main contribution, then native Flex
        // owns its final main allocation. Its cross dimension remains the
        // measured natural value unless the child author explicitly supplies
        // that cross size. A measured root has no owning allocation, so it
        // keeps both natural dimensions.
        let measured_result = measured.get(id as usize).and_then(|value| *value);
        let (width_input, height_input) = if let Some((natural_width, natural_height)) = measured_result {
            match node.parent.and_then(|parent| self.nodes.get(parent as usize)) {
                None => (node.style.width.unwrap_or(natural_width), node.style.height.unwrap_or(natural_height)),
                Some(parent) if parent.grid.is_some() => (node.style.width.unwrap_or(width), node.style.height.unwrap_or(natural_height)),
                Some(parent) if parent.style.axis == TreeAxis::Row => (node.style.width.unwrap_or(width), node.style.height.unwrap_or(natural_height)),
                Some(_) => (node.style.width.unwrap_or(width), node.style.height.unwrap_or(height)),
            }
        } else {
            match node.parent.and_then(|parent| self.nodes.get(parent as usize)) {
                Some(parent) if parent.grid.is_some() => (node.style.width.unwrap_or(width), node.style.height.unwrap_or(height)),
                Some(parent) if parent.style.axis == TreeAxis::Row => (width, node.style.height.unwrap_or(height)),
                Some(_) => (node.style.width.unwrap_or(width), height),
                None => (node.style.width.unwrap_or(width), node.style.height.unwrap_or(height)),
            }
        };
        let (mut resolved_width, mut resolved_height) = (
            width_input.clamp(node.style.min_width, node.style.max_width),
            height_input.clamp(node.style.min_height, node.style.max_height),
        );
        // A ratio derives only the omitted axis, after the parent has made its
        // authoritative main-axis allocation and its bounds have been applied.
        if node.style.aspect_ratio > 0.0 {
            if node.style.width.is_some() && node.style.height.is_none() {
                resolved_height = (resolved_width / node.style.aspect_ratio).clamp(node.style.min_height, node.style.max_height);
            } else if node.style.height.is_some() && node.style.width.is_none() {
                resolved_width = (resolved_height * node.style.aspect_ratio).clamp(node.style.min_width, node.style.max_width);
            }
        }
        if !resolved_width.is_finite() || !resolved_height.is_finite() { return Err(1); }
        let (padding_left, padding_right, padding_top, padding_bottom) = node.style.padding.resolve(resolved_width)?;
        let content_width = (resolved_width - node.style.border_left - node.style.border_right - padding_left - padding_right).max(0.0);
        let content_height = (resolved_height - node.style.border_top - node.style.border_bottom - padding_top - padding_bottom).max(0.0);
        self.boxes[id as usize] = TreeBox { x, y, width: resolved_width, height: resolved_height };
        if node.children.is_empty() { return Ok(()); }
        let local_containing = TreeBox { x: x + node.style.border_left, y: y + node.style.border_top,
            width: (resolved_width - node.style.border_left - node.style.border_right).max(0.0),
            height: (resolved_height - node.style.border_top - node.style.border_bottom).max(0.0) };
        let containing = if node.style.position == 1 { containing.unwrap_or(local_containing) } else { local_containing };
        let flow_children: Vec<u32> = node.children.iter().copied().filter(|&child| self.nodes[child as usize].style.position != 2).collect();
        let origin_x = x + node.style.border_left + padding_left;
        let origin_y = y + node.style.border_top + padding_top;
        let main = if node.style.axis == TreeAxis::Row { content_width } else { content_height };
        let cross = if node.style.axis == TreeAxis::Row { content_height } else { content_width };
        if let Some(mut grid) = node.grid.clone() {
            let (expanded_columns, auto_fit_columns) = expand_auto_repeats(&grid.columns, content_width, grid.column_gap).map_err(|_| 1u32)?;
            let (expanded_rows, auto_fit_rows) = expand_auto_repeats(&grid.rows, content_height, grid.row_gap).map_err(|_| 1u32)?;
            grid.columns = expanded_columns;
            grid.rows = expanded_rows;
            let explicit_columns = grid.columns.len() / 7; let explicit_rows = grid.rows.len() / 7;
            if explicit_columns == 0 || explicit_rows == 0 || grid.columns.len() % 7 != 0 || grid.rows.len() % 7 != 0 { return Err(1); }
            let mut cells = Vec::with_capacity(flow_children.len() * 8);
            for &child in &flow_children { let placement = self.nodes.get(child as usize).ok_or(1u32)?.grid_placement; cells.extend_from_slice(&[placement.column_start as f64, placement.column_span as f64, placement.row_start as f64, placement.row_span as f64, 0.0, 0.0, 0.0, 0.0]); }
            let (column_count, row_count) = assign_cells(&mut cells, explicit_columns, explicit_rows, grid.flow).map_err(|_| 1u32)?;
            if column_count > explicit_columns { let auto = grid.auto_column.ok_or(2u32)?; for _ in explicit_columns..column_count { grid.columns.extend_from_slice(&auto); } }
            if row_count > explicit_rows { let auto = grid.auto_row.ok_or(2u32)?; for _ in explicit_rows..row_count { grid.rows.extend_from_slice(&auto); } }
            let mut column_auto_fit = auto_fit_columns;
            let mut row_auto_fit = auto_fit_rows;
            column_auto_fit.resize(grid.columns.len() / 7, false);
            row_auto_fit.resize(grid.rows.len() / 7, false);
            collapse_auto_fit_tracks(&mut grid.columns, &column_auto_fit, &cells, 0).map_err(|_| 1u32)?;
            collapse_auto_fit_tracks(&mut grid.rows, &row_auto_fit, &cells, 1).map_err(|_| 1u32)?;
            let mut column_contributions = Vec::new(); let mut row_contributions = Vec::new();
            for (index, child) in flow_children.iter().copied().enumerate() { let contribution = intrinsic.get(child as usize).and_then(|value| *value).or_else(|| measured.get(child as usize).and_then(|value| *value).map(|(width, height)| (width, width, height, height))); if let Some((min_width, max_width, min_height, max_height)) = contribution { let cell = &cells[index * 8..index * 8 + 8]; column_contributions.extend_from_slice(&[cell[0], cell[1], min_width, max_width]); row_contributions.extend_from_slice(&[cell[2], cell[3], min_height, max_height]); } }
            apply_contributions(&mut grid.columns, &column_contributions, grid.column_gap, content_width).map_err(|_| 1u32)?;
            apply_contributions(&mut grid.rows, &row_contributions, grid.row_gap, content_height).map_err(|_| 1u32)?;
            resolve_tracks(&mut grid.columns, content_width, grid.column_gap).map_err(|_| 1u32)?;
            resolve_tracks(&mut grid.rows, content_height, grid.row_gap).map_err(|_| 1u32)?;
            for (index, child) in flow_children.iter().copied().enumerate() {
                let cell = &cells[index * 8..index * 8 + 8]; let column = cell[0] as usize - 1; let row = cell[2] as usize - 1; let column_span = cell[1] as usize; let row_span = cell[3] as usize;
                if column + column_span > column_count || row + row_span > row_count { return Err(1); }
                let mut child_x = origin_x; let mut child_y = origin_y; let mut child_width = grid.column_gap * (column_span.saturating_sub(1) as f64); let mut child_height = grid.row_gap * (row_span.saturating_sub(1) as f64);
                for track in 0..column { child_x += grid.columns[track * 7 + 6] + grid.column_gap; }
                for track in 0..row { child_y += grid.rows[track * 7 + 6] + grid.row_gap; }
                for track in column..column + column_span { child_width += grid.columns[track * 7 + 6]; }
                for track in row..row + row_span { child_height += grid.rows[track * 7 + 6]; }
                self.solve_node(child, child_x, child_y, child_width, child_height, content_width, content_height, rtl, measured, intrinsic, Some(containing))?;
            }
            self.solve_absolute_children(&node, containing, rtl, measured, intrinsic)?;
            return Ok(());
        }
        self.arena.nodes.clear();
        for &child in &flow_children {
            let child_node = self.nodes.get(child as usize).ok_or(1u32)?;
            if child_node.style.position == 2 { continue; }
            let style = child_node.style.resolve_for_owner(content_width, content_height, Some(node.style.axis))?;
            let preferred = if node.style.axis == TreeAxis::Row { style.width } else { style.height };
            let cross_preferred = if node.style.axis == TreeAxis::Row { style.height } else { style.width };
            let basis = style.basis.or(preferred).unwrap_or_else(|| measured.get(child as usize).and_then(|value| *value).map(|value| if node.style.axis == TreeAxis::Row { value.0 } else { value.1 }).unwrap_or(0.0));
            let (minimum, maximum) = if node.style.axis == TreeAxis::Row { (style.min_width, style.max_width) } else { (style.min_height, style.max_height) };
            self.arena.nodes.extend_from_slice(&[basis, minimum, maximum, 0.0, style.grow, style.shrink, basis, 0.0, if node.style.axis == TreeAxis::Row { style.margin_left } else { style.margin_top }, if node.style.axis == TreeAxis::Row { style.margin_right } else { style.margin_bottom }]);
            let _ = cross_preferred;
        }
        let main_gap = if node.style.axis == TreeAxis::Row { node.style.column_gap } else { node.style.row_gap };
        let main_gap = if main_gap >= 0.0 { main_gap } else { node.style.gap };
        let cross_gap = if node.style.axis == TreeAxis::Row { node.style.row_gap } else { node.style.column_gap };
        let cross_gap = if cross_gap >= 0.0 { cross_gap } else { node.style.gap };
        let lines = if node.style.wrap == 0 {
            if allocate(&mut self.arena.nodes, main, main_gap) != 0 || align_main(&mut self.arena.nodes, main, main_gap, node.style.justify, (node.style.reverse ^ (rtl && node.style.axis == TreeAxis::Row)) as u32) != 0 { return Err(1); }
            if flow_children.is_empty() { Vec::new() } else { vec![(0, flow_children.len())] }
        } else {
            let lines = form_lines(&self.arena.nodes, main, main_gap)?;
            for &(start, end) in &lines {
                if allocate(&mut self.arena.nodes[start * STRIDE..end * STRIDE], main, main_gap) != 0 || align_main(&mut self.arena.nodes[start * STRIDE..end * STRIDE], main, main_gap, node.style.justify, (node.style.reverse ^ (rtl && node.style.axis == TreeAxis::Row)) as u32) != 0 { return Err(1); }
            }
            lines
        };
        // Compute each line extent once from flow children, before descendant
        // solves reuse the scratch arena. Absolute source slots never enter it.
        let mut line_crosses = Vec::with_capacity(lines.len());
        for &(start, end) in &lines {
            let mut extent: f64 = if node.style.wrap == 0 { cross } else { 0.0 };
            for &child in &flow_children[start..end] {
                let style = self.nodes[child as usize].style.resolve_for_owner(content_width, content_height, Some(node.style.axis))?;
                let natural = measured[child as usize];
                let size = if node.style.axis == TreeAxis::Row { style.height.or(natural.map(|value| value.1)).unwrap_or(cross) + style.margin_top + style.margin_bottom }
                    else { style.width.or(natural.map(|value| value.0)).unwrap_or(cross) + style.margin_left + style.margin_right };
                extent = extent.max(size);
            }
            line_crosses.push(extent);
        }
        let used_cross = line_crosses.iter().sum::<f64>() + cross_gap * lines.len().saturating_sub(1) as f64;
        let free = (cross - used_cross).max(0.0);
        let mut line_origin = 0.0;
        let mut line_gap = cross_gap;
        if node.style.wrap != 0 && !lines.is_empty() {
            match node.style.align_content {
                1 => line_origin = free,
                2 => line_origin = free / 2.0,
                3 => { let extra = free / lines.len() as f64; for size in &mut line_crosses { *size += extra; } },
                4 if lines.len() > 1 => line_gap += free / (lines.len() - 1) as f64,
                5 => { let extra = free / lines.len() as f64; line_origin = extra / 2.0; line_gap += extra; },
                6 => { let extra = free / (lines.len() + 1) as f64; line_origin = extra; line_gap += extra; },
                _ => (),
            }
        }
        let reverse_cross = (node.style.wrap == 2) ^ (rtl && node.style.axis == TreeAxis::Column);
        let mut placements = Vec::with_capacity(flow_children.len());
        for (line, &(start, end)) in lines.iter().enumerate() {
            let extent = line_crosses[line];
            for index in start..end {
                let child = flow_children[index];
                let style = self.nodes[child as usize].style.resolve_for_owner(content_width, content_height, Some(node.style.axis))?;
                let natural = measured[child as usize];
                let (declared_cross, natural_cross, before, after) = if node.style.axis == TreeAxis::Row {
                    (style.height, natural.map(|value| value.1), style.margin_top, style.margin_bottom)
                } else { (style.width, natural.map(|value| value.0), style.margin_left, style.margin_right) };
                let align = if style.align_self == 0 { node.style.align_items } else { style.align_self - 1 };
                let child_cross = if align == 0 && declared_cross.is_none() { (extent - before - after).max(0.0) } else { declared_cross.or(natural_cross).unwrap_or(extent) };
                let local = match align { 2 => extent - child_cross - after, 3 => (extent - child_cross + before - after) / 2.0, _ => before };
                let cross_offset = if reverse_cross { cross - line_origin - local - child_cross } else { line_origin + local };
                let target_main = self.arena.nodes[index * STRIDE + 6];
                let main_offset = self.arena.nodes[index * STRIDE + 7];
                let (child_x, child_y, child_width, child_height) = if node.style.axis == TreeAxis::Row {
                    (origin_x + main_offset, origin_y + cross_offset, target_main, child_cross)
                } else { (origin_x + cross_offset, origin_y + main_offset, child_cross, target_main) };
                placements.push((child, child_x, child_y, child_width, child_height));
            }
            line_origin += extent + line_gap;
        }
        for (child, child_x, child_y, child_width, child_height) in placements {
            self.solve_node(child, child_x, child_y, child_width, child_height, content_width, content_height, rtl, measured, intrinsic, Some(containing))?;
        }
        self.solve_absolute_children(&node, containing, rtl, measured, intrinsic)
    }

    fn solve_absolute_children(&mut self, node: &TreeNode, containing: TreeBox, rtl: bool,
        measured: &[Option<(f64, f64)>], intrinsic: &[Option<(f64, f64, f64, f64)>]) -> Result<(), u32> {
        for &child in &node.children {
            let child_node = self.nodes.get(child as usize).ok_or(1u32)?;
            if child_node.style.position != 2 { continue; }
            let style = child_node.style.resolve_for_owner(containing.width, containing.height, Some(node.style.axis))?;
            let natural = measured[child as usize];
            let width = style.width.or_else(|| match (style.left, style.right) { (Some(left), Some(right)) => Some((containing.width - left - right).max(0.0)), _ => natural.map(|value| value.0) }).unwrap_or(0.0).clamp(style.min_width, style.max_width);
            let height = style.height.or_else(|| match (style.top, style.bottom) { (Some(top), Some(bottom)) => Some((containing.height - top - bottom).max(0.0)), _ => natural.map(|value| value.1) }).unwrap_or(0.0).clamp(style.min_height, style.max_height);
            let x = if rtl && style.right.is_some() || style.left.is_none() { containing.x + style.right.map(|right| containing.width - right - width).unwrap_or(0.0) } else { containing.x + style.left.unwrap_or(0.0) };
            let y = containing.y + style.top.or_else(|| style.bottom.map(|bottom| containing.height - bottom - height)).unwrap_or(0.0);
            self.solve_node(child, x, y, width, height, containing.width, containing.height, rtl, measured, intrinsic, Some(containing))?;
        }
        Ok(())
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    fn style(axis: TreeAxis) -> TreeStyle { TreeStyle { width: None, height: None, width_percent: false, height_percent: false, min_width: 0.0, min_height: 0.0, max_width: f64::INFINITY, max_height: f64::INFINITY, min_width_percent: false, min_height_percent: false, max_width_percent: false, max_height_percent: false, basis: None, basis_percent: false, grow: 0.0, shrink: 0.0, gap: 0.0, row_gap: -1.0, column_gap: -1.0, axis, reverse: false, wrap: 0, justify: 0, align_items: 0, align_self: 0, align_content: 0, margin_left: 0.0, margin_right: 0.0, margin_top: 0.0, margin_bottom: 0.0, padding: TreePadding { left: 0.0, right: 0.0, top: 0.0, bottom: 0.0, left_percent: false, right_percent: false, top_percent: false, bottom_percent: false }, border_left: 0.0, border_right: 0.0, border_top: 0.0, border_bottom: 0.0, position: 0, box_sizing: 0, aspect_ratio: 0.0, left: None, right: None, top: None, bottom: None, left_percent: false, right_percent: false, top_percent: false, bottom_percent: false } }
    #[test]
    fn persistent_tree_uses_native_main_allocation_and_keeps_prior_boxes_until_next_solve() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(20.0); root.gap = 10.0;
        let mut a = style(TreeAxis::Row); a.width = Some(40.0); a.height = Some(20.0); a.basis = Some(40.0);
        let mut b = style(TreeAxis::Row); b.width = Some(50.0); b.height = Some(20.0); b.basis = Some(50.0);
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![TreeNode { id: 0, parent: None, children: vec![1,2], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 1, parent: Some(0), children: vec![], style: a, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 2, parent: Some(0), children: vec![], style: b, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        assert!(tree.prepare(0, 100.0, 20.0).unwrap().is_empty());
        tree.solve(0, 100.0, 20.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 40.0, height: 20.0 }));
        assert_eq!(tree.box_for(2), Some(TreeBox { x: 50.0, y: 0.0, width: 50.0, height: 20.0 }));
        assert_eq!(tree.generation(), 1);
    }
    #[test]
    fn resolves_percentage_sizes_and_bounds_against_the_actual_parent_content_box() {
        let mut root = style(TreeAxis::Row); root.width = Some(200.0); root.height = Some(40.0);
        let mut child = style(TreeAxis::Row); child.width = Some(50.0); child.width_percent = true; child.height = Some(20.0);
        child.min_width = 60.0; child.min_width_percent = true;
        child.max_width = 70.0; child.max_width_percent = true;
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 200.0, 40.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 120.0, height: 20.0 }));
    }

    #[test]
    fn accepts_mixed_unit_bounds_after_resolving_against_the_parent_content_box() {
        let mut root = style(TreeAxis::Row); root.width = Some(1000.0); root.height = Some(20.0);
        let mut child = style(TreeAxis::Row); child.width = Some(300.0); child.height = Some(20.0);
        child.min_width = 100.0; child.max_width = 60.0; child.max_width_percent = true;
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 1000.0, 20.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 300.0, height: 20.0 }));
    }

    #[test]
    fn resolves_percentage_flex_basis_from_the_parent_main_axis_not_the_child_axis() {
        let mut root = style(TreeAxis::Row); root.width = Some(200.0); root.height = Some(80.0);
        let mut child = style(TreeAxis::Column); child.basis = Some(50.0); child.basis_percent = true; child.height = Some(20.0);
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 200.0, 80.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 100.0, height: 20.0 }));
    }

    #[test]
    fn measured_basis_keeps_native_growth_after_the_callback_phase() {
        let mut root = style(TreeAxis::Row); root.width = Some(120.0); root.height = Some(40.0); root.gap = 10.0;
        let mut measured = style(TreeAxis::Row); measured.grow = 1.0; measured.min_width = 20.0; measured.height = Some(20.0);
        let mut fixed = style(TreeAxis::Row); fixed.width = Some(30.0); fixed.height = Some(20.0);
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1,2], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: measured, measure_key: Some(1), intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 2, parent: Some(0), children: vec![], style: fixed, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 120.0, 40.0, false, &[(1, 60.0, 20.0, f64::NAN, f64::NAN, f64::NAN, f64::NAN)]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 80.0, height: 20.0 }));
        assert_eq!(tree.box_for(2), Some(TreeBox { x: 90.0, y: 0.0, width: 30.0, height: 20.0 }));
    }
    #[test]
    fn parent_flex_target_overrides_the_authored_main_size_for_shrink_and_growth() {
        let mut shrink_root = style(TreeAxis::Row); shrink_root.width = Some(100.0); shrink_root.height = Some(20.0);
        let mut declared = style(TreeAxis::Row); declared.width = Some(90.0); declared.height = Some(20.0); declared.shrink = 1.0;
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1, 2], style: shrink_root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: declared, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 2, parent: Some(0), children: vec![], style: declared, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 100.0, 20.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1).unwrap().width, 50.0); assert_eq!(tree.box_for(2).unwrap().width, 50.0);
        let mut grow_root = style(TreeAxis::Row); grow_root.width = Some(100.0); grow_root.height = Some(20.0);
        let mut growing = style(TreeAxis::Row); growing.width = Some(20.0); growing.height = Some(20.0); growing.grow = 1.0;
        tree.replace(2, vec![
            TreeNode { id: 0, parent: None, children: vec![1, 2], style: grow_root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: growing, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 2, parent: Some(0), children: vec![], style: growing, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 100.0, 20.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1).unwrap().width, 50.0); assert_eq!(tree.box_for(2).unwrap().width, 50.0);
    }

    #[test]
    fn preserves_all_parent_sibling_allocations_across_a_nested_flex_solve() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(20.0); root.gap = 10.0;
        let mut nested = style(TreeAxis::Row); nested.width = Some(40.0); nested.height = Some(20.0);
        let mut leaf = style(TreeAxis::Row); leaf.width = Some(10.0); leaf.height = Some(20.0);
        let mut sibling = style(TreeAxis::Row); sibling.width = Some(50.0); sibling.height = Some(20.0);
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1, 3], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 1, parent: Some(0), children: vec![2], style: nested, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 2, parent: Some(1), children: vec![], style: leaf, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
            TreeNode { id: 3, parent: Some(0), children: vec![], style: sibling, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } },
        ]).unwrap();
        tree.solve(0, 100.0, 20.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(3), Some(TreeBox { x: 50.0, y: 0.0, width: 50.0, height: 20.0 }));
    }

    #[test]
    fn direction_is_owned_by_the_native_tree_and_flips_row_main_placement_only() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(20.0);
        let mut a = style(TreeAxis::Row); a.width = Some(20.0); a.height = Some(20.0);
        let mut b = style(TreeAxis::Row); b.width = Some(30.0); b.height = Some(20.0);
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![TreeNode { id: 0, parent: None, children: vec![1, 2], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 1, parent: Some(0), children: vec![], style: a, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 2, parent: Some(0), children: vec![], style: b, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        tree.solve(0, 100.0, 20.0, true, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 80.0, y: 0.0, width: 20.0, height: 20.0 }));
        assert_eq!(tree.box_for(2), Some(TreeBox { x: 50.0, y: 0.0, width: 30.0, height: 20.0 }));
    }
    #[test]
    fn grid_nodes_resolve_tracks_with_the_shared_native_grid_helper() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(40.0);
        let child = style(TreeAxis::Row);
        let tracks = vec![0.0, 40.0, 0.0, 0.0, 4.0, 40.0, 0.0, 2.0, 1.0, 0.0, 0.0, 4.0, 0.0, 0.0];
        let rows = vec![0.0, 40.0, 0.0, 0.0, 4.0, 40.0, 0.0];
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![TreeNode { id: 0, parent: None, children: vec![1, 2], style: root, measure_key: None, intrinsic_key: None, grid: Some(TreeGrid { columns: tracks, rows, auto_column: None, auto_row: None, flow: 0, column_gap: 0.0, row_gap: 0.0 }), grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 2, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        tree.solve(0, 100.0, 40.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 40.0, height: 40.0 }));
        assert_eq!(tree.box_for(2), Some(TreeBox { x: 40.0, y: 0.0, width: 60.0, height: 40.0 }));
    }
    #[test]
    fn grid_uses_shared_sparse_assignment_for_spans_and_configured_implicit_tracks() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(60.0);
        let child = style(TreeAxis::Row);
        let fixed_50 = [0.0, 50.0, 0.0, 0.0, 4.0, 50.0, 0.0];
        let mut tree = StandaloneTree::default();
        let grid = TreeGrid { columns: fixed_50.to_vec(), rows: fixed_50.to_vec(), auto_column: Some(fixed_50), auto_row: Some(fixed_50), flow: 0, column_gap: 0.0, row_gap: 0.0 };
        let automatic = TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 };
        let span = TreeGridPlacement { column_start: 1, column_span: 2, row_start: 1, row_span: 1 };
        tree.replace(1, vec![
            TreeNode { id: 0, parent: None, children: vec![1, 2], style: root, measure_key: None, intrinsic_key: None, grid: Some(grid), grid_placement: automatic },
            TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: span },
            TreeNode { id: 2, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: None, grid: None, grid_placement: automatic },
        ]).unwrap();
        tree.solve(0, 100.0, 60.0, false, &[]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 100.0, height: 50.0 }));
        assert_eq!(tree.box_for(2), Some(TreeBox { x: 0.0, y: 50.0, width: 50.0, height: 50.0 }));
    }
    #[test]
    fn percentage_padding_uses_the_owner_width_and_preserves_content_measurement_constraints() {
        let mut root = style(TreeAxis::Row); root.width = Some(200.0); root.height = Some(80.0); root.padding = TreePadding { left: 10.0, right: 10.0, top: 5.0, bottom: 5.0, left_percent: true, right_percent: true, top_percent: false, bottom_percent: false };
        let mut measured = style(TreeAxis::Row); measured.width = None; measured.height = None;
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![TreeNode { id: 0, parent: None, children: vec![1], style: root, measure_key: None, intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }, TreeNode { id: 1, parent: Some(0), children: vec![], style: measured, measure_key: Some(1), intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        assert_eq!(tree.prepare(0, 200.0, 80.0).unwrap(), vec![TreeMeasureRequest { node: 1, kind: 0, width: 160.0, height: 70.0 }]);
        tree.solve(0, 200.0, 80.0, false, &[(1, 20.0, 10.0, f64::NAN, f64::NAN, f64::NAN, f64::NAN)]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 20.0, y: 5.0, width: 20.0, height: 10.0 }));
    }
    #[test]
    fn grid_intrinsic_callbacks_feed_the_shared_native_contribution_phase() {
        let mut root = style(TreeAxis::Row); root.width = Some(100.0); root.height = Some(20.0);
        let child = style(TreeAxis::Row); let automatic = TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 };
        let grid = TreeGrid { columns: vec![5.0, 0.0, 0.0, 0.0, 4.0, 0.0, 0.0], rows: vec![0.0, 20.0, 0.0, 0.0, 4.0, 20.0, 0.0], auto_column: None, auto_row: None, flow: 0, column_gap: 0.0, row_gap: 0.0 };
        let mut tree = StandaloneTree::default();
        tree.replace(1, vec![TreeNode { id: 0, parent: None, children: vec![1], style: root, measure_key: None, intrinsic_key: None, grid: Some(grid), grid_placement: automatic }, TreeNode { id: 1, parent: Some(0), children: vec![], style: child, measure_key: None, intrinsic_key: Some(1), grid: None, grid_placement: automatic }]).unwrap();
        tree.solve(0, 100.0, 20.0, false, &[(1, f64::NAN, f64::NAN, 20.0, 40.0, 10.0, 20.0)]).unwrap();
        assert_eq!(tree.box_for(1), Some(TreeBox { x: 0.0, y: 0.0, width: 40.0, height: 20.0 }));
    }
    #[test]
    fn intrinsic_requests_are_distinct_from_final_measurement_requests() {
        let mut measured = style(TreeAxis::Row); measured.width = None; measured.height = None;
        let mut tree = StandaloneTree::default();
        tree.replace(3, vec![TreeNode { id: 0, parent: None, children: vec![], style: measured, measure_key: Some(3), intrinsic_key: Some(3), grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        assert_eq!(tree.prepare(0, 30.0, 20.0).unwrap(), vec![
            TreeMeasureRequest { node: 0, kind: 0, width: 30.0, height: 20.0 },
            TreeMeasureRequest { node: 0, kind: 1, width: 30.0, height: 20.0 },
        ]);
    }
    #[test]
    fn persistent_tree_requires_fresh_finite_measurement_results() {
        let mut measured = style(TreeAxis::Row); measured.width = None; measured.height = None;
        let mut tree = StandaloneTree::default();
        tree.replace(2, vec![TreeNode { id: 0, parent: None, children: vec![], style: measured, measure_key: Some(9), intrinsic_key: None, grid: None, grid_placement: TreeGridPlacement { column_start: 0, column_span: 1, row_start: 0, row_span: 1 } }]).unwrap();
        assert_eq!(tree.prepare(0, 30.0, 20.0).unwrap(), vec![TreeMeasureRequest { node: 0, kind: 0, width: 30.0, height: 20.0 }]);
        assert_eq!(tree.solve(0, 30.0, 20.0, false, &[]), Err(1));
        tree.solve(0, 30.0, 20.0, false, &[(0, 12.0, 8.0, f64::NAN, f64::NAN, f64::NAN, f64::NAN)]).unwrap();
        assert_eq!(tree.box_for(0), Some(TreeBox { x: 0.0, y: 0.0, width: 12.0, height: 8.0 }));
    }
}

const TREE_NODE_STRIDE: usize = 70;
const TREE_MEASUREMENT_STRIDE: usize = 7;
struct TreeSlot { generation: u32, root: u32, rtl: bool, tree: Option<StandaloneTree>, node_input: Vec<f64>, child_input: Vec<u32>, grid_input: Vec<f64>, requests: Vec<TreeMeasureRequest>, last_queries: Vec<TreeMeasureRequest>, measured: Vec<f64>, cached: Vec<f64> }
struct TreePool { slots: Vec<TreeSlot>, closed: bool }
thread_local! { static STANDALONE_TREES: std::cell::RefCell<TreePool> = const { std::cell::RefCell::new(TreePool { slots: Vec::new(), closed: false }) }; }
fn with_tree<R>(handle: u32, generation: u32, invalid: R, work: impl FnOnce(&mut TreeSlot) -> R) -> R {
    STANDALONE_TREES.with(|pool| { let mut pool = pool.borrow_mut(); if pool.closed || generation == 0 { return invalid; } let Some(index) = handle.checked_sub(1) else { return invalid; }; let Some(slot) = pool.slots.get_mut(index as usize) else { return invalid; }; if slot.generation != generation || slot.tree.is_none() { return invalid; } work(slot) })
}
pub(crate) fn standalone_tree_create_impl() -> u32 { STANDALONE_TREES.with(|pool| { let mut pool = pool.borrow_mut(); if pool.closed { return 0; } for (index, slot) in pool.slots.iter_mut().enumerate() { if slot.tree.is_none() && slot.generation != u32::MAX { slot.generation += 1; slot.tree = Some(StandaloneTree::default()); slot.root = 0; slot.rtl = false; slot.node_input.clear(); slot.child_input.clear(); slot.grid_input.clear(); slot.requests.clear(); slot.last_queries.clear(); slot.measured.clear(); slot.cached.clear(); return (index + 1) as u32; } } let handle = match u32::try_from(pool.slots.len() + 1) { Ok(value) => value, Err(_) => return 0 }; pool.slots.push(TreeSlot { generation: 1, root: 0, rtl: false, tree: Some(StandaloneTree::default()), node_input: Vec::new(), child_input: Vec::new(), grid_input: Vec::new(), requests: Vec::new(), last_queries: Vec::new(), measured: Vec::new(), cached: Vec::new() }); handle }) }
pub(crate) fn standalone_tree_generation_impl(handle: u32) -> u32 { STANDALONE_TREES.with(|pool| { let pool = pool.borrow(); let Some(index) = handle.checked_sub(1) else { return 0; }; pool.slots.get(index as usize).filter(|slot| slot.tree.is_some()).map_or(0, |slot| slot.generation) }) }
pub(crate) fn standalone_tree_dispose_impl(handle: u32, generation: u32) -> u32 { STANDALONE_TREES.with(|pool| { let mut pool = pool.borrow_mut(); let Some(index) = handle.checked_sub(1) else { return 1; }; let Some(slot) = pool.slots.get_mut(index as usize) else { return 1; }; if slot.generation != generation || slot.tree.is_none() { return 1; } slot.tree = None; slot.node_input.clear(); slot.child_input.clear(); slot.grid_input.clear(); slot.requests.clear(); slot.measured.clear(); 0 }) }
pub(crate) fn standalone_tree_resize_nodes_impl(handle: u32, generation: u32, count: usize) -> *mut f64 { with_tree(handle, generation, std::ptr::null_mut(), |slot| { let Some(length) = count.checked_mul(TREE_NODE_STRIDE) else { return std::ptr::null_mut(); }; slot.node_input.resize(length, 0.0); slot.node_input.as_mut_ptr() }) }
pub(crate) fn standalone_tree_resize_grid_impl(handle: u32, generation: u32, count: usize) -> *mut f64 { with_tree(handle, generation, std::ptr::null_mut(), |slot| { slot.grid_input.resize(count, 0.0); slot.grid_input.as_mut_ptr() }) }
pub(crate) fn standalone_tree_resize_children_impl(handle: u32, generation: u32, count: usize) -> *mut u32 { with_tree(handle, generation, std::ptr::null_mut(), |slot| { slot.child_input.resize(count, 0); slot.child_input.as_mut_ptr() }) }
fn tree_length(value: f64, unit: f64, minimum: bool) -> Result<(Option<f64>, bool), u32> {
    if !value.is_finite() || !unit.is_finite() || unit.fract() != 0.0 { return Err(1); }
    let (value, percent) = match unit as u32 {
        0 | 3 => (None, false),
        1 => if value >= 0.0 { (Some(value), false) } else { return Err(1) },
        2 => if value >= 0.0 { (Some(value), true) } else { return Err(1) },
        _ => return Err(1),
    };
    Ok((if value.is_none() && minimum { Some(0.0) } else { value }, percent))
}
fn tree_max(value: f64, unit: f64) -> Result<(f64, bool), u32> {
    let (value, percent) = tree_length(value, unit, false)?;
    Ok((value.unwrap_or(f64::INFINITY), percent))
}
fn tree_scalar(value: f64, unit: f64) -> Result<f64, u32> {
    let (value, percent) = tree_length(value, unit, false)?;
    if percent { return Err(2); }
    Ok(value.unwrap_or(0.0))
}
fn decode_tree_nodes(records: &[f64], children: &[u32], grid_input: &[f64]) -> Result<Vec<TreeNode>, u32> {
    if records.len() % TREE_NODE_STRIDE != 0 { return Err(1); }
    let count = records.len() / TREE_NODE_STRIDE; let mut output = Vec::with_capacity(count);
    for (index, record) in records.chunks_exact(TREE_NODE_STRIDE).enumerate() {
        if record[0] != index as f64 || record[0].fract() != 0.0 || !record[1].is_finite() || record[1].fract() != 0.0 || record[1] < -1.0 || record[1] >= count as f64 || !record[2].is_finite() || !record[3].is_finite() || record[2].fract() != 0.0 || record[3].fract() != 0.0 || record[2] < 0.0 || record[3] < 0.0 { return Err(1); }
        let child_start = record[2] as usize; let child_count = record[3] as usize; let child_end = child_start.checked_add(child_count).ok_or(1u32)?; if child_end > children.len() { return Err(1); }
        let axis = match record[23] as u32 { 0 | 1 => TreeAxis::Row, 2 | 3 => TreeAxis::Column, _ => return Err(1) };
        if !record[24].is_finite() || record[24].fract() != 0.0 || record[24] < 0.0 || record[24] > 2.0 || !record[25].is_finite() || record[25].fract() != 0.0 || record[25] < 0.0 || record[25] > 5.0 || !record[26].is_finite() || record[26].fract() != 0.0 || record[26] < 0.0 || record[26] > 6.0 || !record[27].is_finite() || record[27].fract() != 0.0 || record[27] < 0.0 || record[27] > 7.0 { return Err(1); }
        let (width, width_percent) = tree_length(record[4], record[5], false)?;
        let (height, height_percent) = tree_length(record[6], record[7], false)?;
        let (min_width, min_width_percent) = tree_length(record[8], record[9], true)?;
        let (min_height, min_height_percent) = tree_length(record[10], record[11], true)?;
        let (max_width, max_width_percent) = tree_max(record[12], record[13])?;
        let (max_height, max_height_percent) = tree_max(record[14], record[15])?;
        let (basis, basis_percent) = tree_length(record[16], record[17], false)?;
        let (left, left_percent) = tree_length(record[54], record[55], false)?;
        let (right, right_percent) = tree_length(record[56], record[57], false)?;
        let (top, top_percent) = tree_length(record[58], record[59], false)?;
        let (bottom, bottom_percent) = tree_length(record[60], record[61], false)?;
        if !record[50].is_finite() || record[50].fract() != 0.0 || !(0.0..=6.0).contains(&record[50]) || !record[51].is_finite() || record[51].fract() != 0.0 || !(0.0..=2.0).contains(&record[51]) || !record[52].is_finite() || record[52].fract() != 0.0 || !(0.0..=1.0).contains(&record[52]) || !record[53].is_finite() || record[53] < 0.0 || !record[62].is_finite() || !record[63].is_finite() || !record[64].is_finite() || !record[65].is_finite() { return Err(1); }
        let style = TreeStyle { width, height, width_percent, height_percent,
            min_width: min_width.unwrap_or(0.0), min_height: min_height.unwrap_or(0.0), max_width, max_height,
            min_width_percent, min_height_percent, max_width_percent, max_height_percent,
            basis, basis_percent, grow: record[18], shrink: record[19], gap: record[20], row_gap: record[21], column_gap: record[22], axis,
            reverse: record[23] == 1.0 || record[23] == 3.0, wrap: record[24] as u32, justify: record[25] as u32,
            align_items: record[26] as u32, align_self: record[27] as u32, align_content: record[50] as u32,
            margin_left: tree_scalar(record[28], record[29])?, margin_right: tree_scalar(record[30], record[31])?,
            margin_top: tree_scalar(record[32], record[33])?, margin_bottom: tree_scalar(record[34], record[35])?,
            padding: TreePadding { left: record[36], left_percent: record[37] == 2.0, right: record[38], right_percent: record[39] == 2.0, top: record[40], top_percent: record[41] == 2.0, bottom: record[42], bottom_percent: record[43] == 2.0 },
            border_left: record[62], border_right: record[63], border_top: record[64], border_bottom: record[65], position: record[51] as u32, box_sizing: record[52] as u32, aspect_ratio: record[53], left, right, top, bottom, left_percent, right_percent, top_percent, bottom_percent }.validate()?;
        if !record[36].is_finite() || !record[37].is_finite() || !record[38].is_finite() || !record[39].is_finite() || !record[40].is_finite() || !record[41].is_finite() || !record[42].is_finite() || !record[43].is_finite() || !matches!(record[37] as u32, 1 | 2) || !matches!(record[39] as u32, 1 | 2) || !matches!(record[41] as u32, 1 | 2) || !matches!(record[43] as u32, 1 | 2) || (record[44] != 0.0 && record[44] != 1.0) || (record[49] != 0.0 && record[49] != 1.0) { return Err(1); }
        if !record[45].is_finite() || !record[46].is_finite() || !record[47].is_finite() || !record[48].is_finite() || record[45].fract() != 0.0 || record[46].fract() != 0.0 || record[47].fract() != 0.0 || record[48].fract() != 0.0 || record[45] < 0.0 || record[47] < 0.0 || record[46] < 1.0 || record[48] < 1.0 { return Err(1); }
        output.push(TreeNode { id: index as u32, parent: if record[1] < 0.0 { None } else { Some(record[1] as u32) }, children: children[child_start..child_end].to_vec(), style, measure_key: if record[44] == 1.0 { Some(index as u32) } else { None }, intrinsic_key: if record[49] == 1.0 { Some(index as u32) } else { None }, grid: None, grid_placement: TreeGridPlacement { column_start: record[45] as usize, column_span: record[46] as usize, row_start: record[47] as usize, row_span: record[48] as usize } });
    }
    let mut offset = 0usize;
    while offset < grid_input.len() {
        // Eight scalar fields are followed by one seven-value record for each
        // configured implicit axis: 8 + 7 + 7, before explicit tracks.
        const HEADER: usize = 22;
        if offset.checked_add(HEADER).ok_or(1u32)? > grid_input.len() { return Err(1); }
        let node_id = grid_input[offset]; let columns = grid_input[offset + 1]; let rows = grid_input[offset + 2]; let column_gap = grid_input[offset + 3]; let row_gap = grid_input[offset + 4]; let flow = grid_input[offset + 5]; let has_auto_column = grid_input[offset + 6]; let has_auto_row = grid_input[offset + 7];
        if !node_id.is_finite() || node_id.fract() != 0.0 || node_id < 0.0 || node_id as usize >= output.len() || !columns.is_finite() || columns.fract() != 0.0 || columns <= 0.0 || !rows.is_finite() || rows.fract() != 0.0 || rows <= 0.0 || !column_gap.is_finite() || column_gap < 0.0 || !row_gap.is_finite() || row_gap < 0.0 || !flow.is_finite() || flow.fract() != 0.0 || flow < 0.0 || flow > 3.0 || !matches!(has_auto_column, 0.0 | 1.0) || !matches!(has_auto_row, 0.0 | 1.0) { return Err(1); }
        let length = HEADER.checked_add((columns as usize).checked_add(rows as usize).ok_or(1u32)?.checked_mul(7).ok_or(1u32)?).ok_or(1u32)?;
        if offset.checked_add(length).ok_or(1u32)? > grid_input.len() { return Err(1); }
        let split = offset + HEADER + columns as usize * 7;
        let auto_column: [f64; 7] = grid_input[offset + 8..offset + 15].try_into().map_err(|_| 1u32)?; let auto_row: [f64; 7] = grid_input[offset + 15..offset + 22].try_into().map_err(|_| 1u32)?;
        let node = &mut output[node_id as usize]; if node.grid.is_some() { return Err(1); }
        node.grid = Some(TreeGrid { columns: grid_input[offset + HEADER..split].to_vec(), rows: grid_input[split..offset + length].to_vec(), auto_column: if has_auto_column == 1.0 { Some(auto_column) } else { None }, auto_row: if has_auto_row == 1.0 { Some(auto_row) } else { None }, flow: flow as u32, column_gap, row_gap });
        offset += length;
    }
    Ok(output)
}
pub(crate) fn standalone_tree_replace_impl(handle: u32, generation: u32, root: u32, direction: u32) -> u32 { with_tree(handle, generation, 1, |slot| { if direction > 1 { return 1; } let nodes = match decode_tree_nodes(&slot.node_input, &slot.child_input, &slot.grid_input) { Ok(nodes) => nodes, Err(status) => return status }; let Some(tree) = slot.tree.as_mut() else { return 1; }; let next_generation = tree.generation().checked_add(1).unwrap_or(1); if root as usize >= nodes.len() || tree.replace(next_generation, nodes).is_err() { return 1; } slot.root = root; slot.rtl = direction == 1; slot.requests.clear(); slot.measured.clear(); 0 }) }
pub(crate) fn standalone_tree_prepare_impl(handle: u32, generation: u32, width: f64, height: f64) -> u32 { with_tree(handle, generation, 1, |slot| { let Some(tree) = slot.tree.as_ref() else { return 1; }; match tree.prepare(slot.root, width, height) { Ok(requests) => { slot.last_queries = requests.clone(); slot.requests = requests; slot.cached = vec![f64::NAN; tree.nodes.len() * TREE_MEASUREMENT_STRIDE]; 0 }, Err(status) => status } }) }
pub(crate) fn standalone_tree_prepare_settled_measurements_impl(handle: u32, generation: u32) -> u32 { with_tree(handle, generation, 1, |slot| { let Some(tree) = slot.tree.as_ref() else { return 1; }; let all = match tree.prepare_settled_measurements() { Ok(requests) => requests, Err(status) => return status }; let mut changed = Vec::new(); for request in all { let same = slot.last_queries.iter().any(|prior| prior.node == request.node && prior.kind == request.kind && prior.width == request.width && prior.height == request.height); if !same { slot.last_queries.retain(|prior| prior.node != request.node || prior.kind != request.kind); slot.last_queries.push(request); changed.push(request); } } slot.requests = changed; slot.measured.clear(); 0 }) }
pub(crate) fn standalone_tree_measure_count_impl(handle: u32, generation: u32) -> usize { with_tree(handle, generation, 0, |slot| slot.requests.len()) }
pub(crate) fn standalone_tree_measure_value_impl(handle: u32, generation: u32, index: usize, field: usize) -> f64 { with_tree(handle, generation, f64::NAN, |slot| { let Some(request) = slot.requests.get(index) else { return f64::NAN; }; match field { 0 => request.node as f64, 1 => request.width, 2 => request.width, 3 => request.height, 4 => request.height, _ => f64::NAN } }) }
pub(crate) fn standalone_tree_measure_kind_impl(handle: u32, generation: u32, index: usize) -> u32 { with_tree(handle, generation, u32::MAX, |slot| slot.requests.get(index).map_or(u32::MAX, |request| request.kind)) }
pub(crate) fn standalone_tree_resize_measurements_impl(handle: u32, generation: u32, count: usize) -> *mut f64 { with_tree(handle, generation, std::ptr::null_mut(), |slot| { if count != slot.requests.len() { return std::ptr::null_mut(); } let Some(length) = count.checked_mul(TREE_MEASUREMENT_STRIDE) else { return std::ptr::null_mut(); }; slot.measured.resize(length, f64::NAN); slot.measured.as_mut_ptr() }) }
pub(crate) fn standalone_tree_solve_impl(handle: u32, generation: u32, width: f64, height: f64) -> u32 { with_tree(handle, generation, 1, |slot| { let Some(tree) = slot.tree.as_mut() else { return 1; }; if slot.measured.len() != slot.requests.len() * TREE_MEASUREMENT_STRIDE || slot.cached.len() != tree.nodes.len() * TREE_MEASUREMENT_STRIDE { return 1; } for (index, record) in slot.measured.chunks_exact(TREE_MEASUREMENT_STRIDE).enumerate() { if !record[0].is_finite() || record[0].fract() != 0.0 { return 1; } let Some(request) = slot.requests.get(index) else { return 1; }; if request.node != record[0] as u32 || request.node as usize >= tree.nodes.len() { return 1; } let target = &mut slot.cached[request.node as usize * TREE_MEASUREMENT_STRIDE..(request.node as usize + 1) * TREE_MEASUREMENT_STRIDE]; if request.kind == 0 { if !record[1].is_finite() || !record[2].is_finite() || record[1] < 0.0 || record[2] < 0.0 { return 1; } target[1] = record[1]; target[2] = record[2]; } else if request.kind == 1 { if !record[3].is_finite() || !record[4].is_finite() || !record[5].is_finite() || !record[6].is_finite() || record[3] < 0.0 || record[5] < 0.0 || record[3] > record[4] || record[5] > record[6] { return 1; } target[3] = record[3]; target[4] = record[4]; target[5] = record[5]; target[6] = record[6]; } else { return 1; } } let mut measured = Vec::with_capacity(tree.nodes.len()); for id in 0..tree.nodes.len() { let record = &slot.cached[id * TREE_MEASUREMENT_STRIDE..(id + 1) * TREE_MEASUREMENT_STRIDE]; measured.push((id as u32, record[1], record[2], record[3], record[4], record[5], record[6])); } tree.solve(slot.root, width, height, slot.rtl, &measured).map_or_else(|status| status, |_| 0) }) }
pub(crate) fn standalone_tree_box_count_impl(handle: u32, generation: u32) -> usize { with_tree(handle, generation, 0, |slot| slot.tree.as_ref().map_or(0, |tree| tree.nodes.len())) }
pub(crate) fn standalone_tree_box_value_impl(handle: u32, generation: u32, index: usize, field: usize) -> f64 { with_tree(handle, generation, f64::NAN, |slot| { let Some(tree) = slot.tree.as_ref() else { return f64::NAN; }; let Some(box_) = tree.box_for(index as u32) else { return f64::NAN; }; match field { 0 => index as f64, 1 => box_.x, 2 => box_.y, 3 => box_.width, 4 => box_.height, _ => f64::NAN } }) }


pub(crate) fn dispose_all_trees() {
    STANDALONE_TREES.with(|pool| {
        let mut pool = pool.borrow_mut();
        pool.closed = true;
        pool.slots.clear();
    });
}

#[no_mangle] pub extern "C" fn standalone_tree_create() -> u32 { standalone_tree_create_impl() }
#[no_mangle] pub extern "C" fn standalone_tree_generation(handle: u32) -> u32 { standalone_tree_generation_impl(handle) }
#[no_mangle] pub extern "C" fn standalone_tree_dispose(handle: u32, generation: u32) -> u32 { standalone_tree_dispose_impl(handle, generation) }
#[no_mangle] pub extern "C" fn standalone_tree_resize_nodes(handle: u32, generation: u32, count: usize) -> *mut f64 { standalone_tree_resize_nodes_impl(handle, generation, count) }
#[no_mangle] pub extern "C" fn standalone_tree_resize_grid(handle: u32, generation: u32, count: usize) -> *mut f64 { standalone_tree_resize_grid_impl(handle, generation, count) }
#[no_mangle] pub extern "C" fn standalone_tree_resize_children(handle: u32, generation: u32, count: usize) -> *mut u32 { standalone_tree_resize_children_impl(handle, generation, count) }
#[no_mangle] pub extern "C" fn standalone_tree_replace(handle: u32, generation: u32, root: u32, direction: u32) -> u32 { if direction > 1 { return 1; } standalone_tree_replace_impl(handle, generation, root, direction) }
#[no_mangle] pub extern "C" fn standalone_tree_prepare(handle: u32, generation: u32, width: f64, height: f64) -> u32 { standalone_tree_prepare_impl(handle, generation, width, height) }
#[no_mangle] pub extern "C" fn standalone_tree_prepare_settled_measurements(handle: u32, generation: u32) -> u32 { standalone_tree_prepare_settled_measurements_impl(handle, generation) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_count(handle: u32, generation: u32) -> usize { standalone_tree_measure_count_impl(handle, generation) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_node(handle: u32, generation: u32, index: usize) -> u32 { standalone_tree_measure_value_impl(handle, generation, index, 0) as u32 }
#[no_mangle] pub extern "C" fn standalone_tree_measure_kind(handle: u32, generation: u32, index: usize) -> u32 { standalone_tree_measure_kind_impl(handle, generation, index) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_width_min(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_measure_value_impl(handle, generation, index, 1) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_width_max(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_measure_value_impl(handle, generation, index, 2) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_height_min(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_measure_value_impl(handle, generation, index, 3) }
#[no_mangle] pub extern "C" fn standalone_tree_measure_height_max(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_measure_value_impl(handle, generation, index, 4) }
#[no_mangle] pub extern "C" fn standalone_tree_resize_measurements(handle: u32, generation: u32, count: usize) -> *mut f64 { standalone_tree_resize_measurements_impl(handle, generation, count) }
#[no_mangle] pub extern "C" fn standalone_tree_solve(handle: u32, generation: u32, width: f64, height: f64) -> u32 { standalone_tree_solve_impl(handle, generation, width, height) }
#[no_mangle] pub extern "C" fn standalone_tree_box_count(handle: u32, generation: u32) -> usize { standalone_tree_box_count_impl(handle, generation) }
#[no_mangle] pub extern "C" fn standalone_tree_box_id(handle: u32, generation: u32, index: usize) -> u32 { standalone_tree_box_value_impl(handle, generation, index, 0) as u32 }
#[no_mangle] pub extern "C" fn standalone_tree_box_x(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_box_value_impl(handle, generation, index, 1) }
#[no_mangle] pub extern "C" fn standalone_tree_box_y(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_box_value_impl(handle, generation, index, 2) }
#[no_mangle] pub extern "C" fn standalone_tree_box_width(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_box_value_impl(handle, generation, index, 3) }
#[no_mangle] pub extern "C" fn standalone_tree_box_height(handle: u32, generation: u32, index: usize) -> f64 { standalone_tree_box_value_impl(handle, generation, index, 4) }
