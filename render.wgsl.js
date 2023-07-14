import {
	FRAME_WIDTH_PIX,
	FRAME_HEIGHT_PIX,
	STAR_COLOR,
	STAR_COUNT,
	STAR_WIDTH_CLIP,
	STAR_HEIGHT_CLIP,
	ASPECT_RATIO_CORRECTION,
} from "./constants.js";


export default /* wgsl */`
	struct VertexInput {
		@builtin(instance_index) i_instance: u32,
		@builtin(vertex_index) i_vertex: u32,
	};

	struct VertexOutput {
		@builtin(position) pos: vec4f,
		@location(0) quad_pos: vec2f,
	};

	@group(0) @binding(0) var<storage> states: array<vec4f, ${STAR_COUNT}>;
	@group(0) @binding(2) var<storage> not_vertices: array<vec4f, 6>;


	// x, y, z, w
	@vertex
	fn vertex_main(in: VertexInput) -> VertexOutput {
		var out: VertexOutput;
		out.quad_pos = states[in.i_instance].xy;
		var pos = out.quad_pos + not_vertices[in.i_vertex].xy;
		// pos.y *= ${ASPECT_RATIO_CORRECTION};
		out.pos = vec4f(pos, 0, 1);
		return out;
	}


	// r, g, b, a
	@fragment
	fn fragment_main(in: VertexOutput) -> @location(0) vec4f {
		// return vec4f(1, 1, 1, 1);  // DEBUG

		// Convert from pixel space to clip space
		var pixel_pos = vec2f(
			(in.pos.x / ${FRAME_WIDTH_PIX / 2}) - 1,
			((in.pos.y / ${FRAME_HEIGHT_PIX / 2}) - 1) * -1  // TODO: why * -1
		);

		// pixel_pos.x -= 0.5;
		// pixel_pos.x *= ${1/1.01};
		// pixel_pos.x += 0.5;

		let alpha = 1 - (distance(in.quad_pos, pixel_pos)) / ${STAR_WIDTH_CLIP};
		return vec4f(${STAR_COLOR.join(",")}, alpha * 2);
	}
`;
