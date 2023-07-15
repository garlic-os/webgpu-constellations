import { WORKGROUP_SIZE } from "./constants.js";
import { wgslUniforms } from "./uniforms.wgsl.js";


export default /* wgsl */ `
	${wgslUniforms}

	@group(0) @binding(0) var<uniform> u: Uniforms;
	@group(0) @binding(1) var<storage> states_in: array<vec4f>;
	@group(0) @binding(2) var<storage, read_write> states_out: array<vec4f>;

	@compute
	@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
	fn compute_main(@builtin(global_invocation_id) id: vec3u) {
		let i = id.x;
		states_out[i].x = states_in[i].x + states_in[i].z;
		states_out[i].y = states_in[i].y + states_in[i].w;

		// Bounce off the edges of the screen.
		// Snap to the edge of the screen, too, so it doesn't disappear in
		// case the canvas is resized.
		// Left edge
		if (states_in[i].x - u.star_radius < -1) {
			states_out[i].z *= -1;
			states_out[i].x = -1 + u.star_radius;
		}

		// Right edge
		else if (states_in[i].x + u.star_radius > 1) {
			states_out[i].z *= -1;
			states_out[i].x = 1 - u.star_radius;
		}

		// Top edge
		if (states_in[i].y + u.star_radius > 1) {
			states_out[i].w *= -1;
			states_out[i].y = 1 - u.star_radius;
		}

		// Bottom edge
		else if (states_in[i].y - u.star_radius < -1) {
			states_out[i].w *= -1;
			states_out[i].y = -1 + u.star_radius;
		}
	}
`;
