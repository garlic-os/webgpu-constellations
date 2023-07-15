import { canvas, device } from "./canvas.js";


export const wgslUniforms = /* wgsl */ `
	struct Uniforms {
		star_color: vec4<f32>,
		res: vec2<f32>,  // pixel space
		star_count: u32,
		star_radius: f32,  // clip space
		line_thickness: f32,  // clip space
		line_threshold: f32,  // clip space
		_pad: vec2<u32>,
	}
`;

export const uniforms = {
	star_color: [0.898, 0.89, 0.8745, 1.0],
	res: [canvas.width, canvas.height],
	star_count: 115,
	star_radius: 1/20,
	line_thickness: 1/60,
	line_threshold: 1/5,
	_pad: [0, 0],
};

export const uniformArray = new Float32Array(Object.values(uniforms).flat());
export const uniformBuffer = device.createBuffer({
  label: "Uniforms",
  size: uniformArray.byteLength,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

export function updateUniforms() {
	uniformArray.set(Object.values(uniforms).flat());
	device.queue.writeBuffer(uniformBuffer, 0, uniformArray);
}
