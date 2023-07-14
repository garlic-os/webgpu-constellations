import {
	STAR_COUNT,
	STAR_WIDTH_CLIP,
	STAR_HEIGHT_CLIP,
	WORKGROUP_SIZE,
} from "./constants.js";


export default /* wgsl */ `
	@group(0) @binding(0) var<storage> states_in: array<vec4f, ${STAR_COUNT}>;
	@group(0) @binding(1) var<storage, read_write> states_out: array<vec4f, ${STAR_COUNT}>;

	@compute
	@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
	fn compute_main(@builtin(global_invocation_id) star: vec3u) {
		let i = star.x;
		states_out[i].x = states_in[i].x + states_in[i].z;
		states_out[i].y = states_in[i].y + states_in[i].w;

		// Bounce off the edges of the screen.
		// Snap to the edge of the screen, too, so it doesn't disappear in
		// case the canvas is resized.
		// Left edge
		if (states_in[i].x - ${STAR_WIDTH_CLIP} < -1) {
			states_out[i].z *= -1;
			states_out[i].x = -1 + ${STAR_WIDTH_CLIP};
		}

		// Right edge
		else if (states_in[i].x + ${STAR_WIDTH_CLIP} > 1) {
			states_out[i].z *= -1;
			states_out[i].x = 1 - ${STAR_WIDTH_CLIP};
		}

		// Top edge
		if (states_in[i].y + ${STAR_WIDTH_CLIP} > 1) {
			states_out[i].w *= -1;
			states_out[i].y = 1 - ${STAR_HEIGHT_CLIP};
		}

		// Bottom edge
		else if (states_in[i].y - ${STAR_WIDTH_CLIP} < -1) {
			states_out[i].w *= -1;
			states_out[i].y = -1 + ${STAR_HEIGHT_CLIP};
		}
	}
`;
