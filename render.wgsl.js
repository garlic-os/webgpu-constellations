import { wgslUniforms } from "./uniforms.wgsl.js";


export default /* wgsl */`
	${wgslUniforms}

	struct VertexInput {
		@builtin(instance_index) i_instance: u32,
		@location(0) vertex_pos: vec2f,
	};

	struct VertexOutput {
		@builtin(position) pixel_pos: vec4f,
		@location(0) quad_pos: vec2f,
	};

	@group(0) @binding(0) var<uniform> u: Uniforms;
	@group(0) @binding(1) var<storage> states: array<vec4f>;


	fn aspect_ratio() -> f32 {
		return f32(u.res.x) / f32(u.res.y);
	}

	fn clip_space(pos: vec2f) -> vec2f {
		return vec2f(
			( 2 * pos.x / u.res.x) - 1,
			(-2 * pos.y / u.res.y) + 1
		);
	}


	// x, y, z, w
	@vertex
	fn vertex_main(in: VertexInput) -> VertexOutput {
		var out: VertexOutput;
		out.quad_pos = states[in.i_instance].xy;
		out.pixel_pos = vec4f(out.quad_pos - in.vertex_pos, 0, 1);
		return out;
	}


	// r, g, b, a
	@fragment
	fn fragment_main(in: VertexOutput) -> @location(0) vec4f {
		return vec4f(1, 1, 1, 1);  // DEBUG
		let pixel_pos = clip_space(in.pixel_pos.xy);
		var alpha = distance(in.quad_pos, pixel_pos);
		let alpha_x = 1 - alpha / (u.star_radius / aspect_ratio());
		let alpha_y = 1 - alpha / u.star_radius;

		alpha = (
			(alpha_x * cos(in.quad_pos.x) / ${Math.PI}) +
			(aspect_ratio() * alpha_y)
		);

		var color = u.star_color;
		color.a = alpha;
		return color;
	}
`;
