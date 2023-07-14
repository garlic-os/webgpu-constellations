export const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("No <canvas> element found");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
// canvas.width = 700;
// canvas.height = 256;

if (!navigator.gpu) {
	throw new Error("Failed to access the WebGPU API");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
	throw new Error("No supported GPU adapter found");
}

export const device = await adapter.requestDevice();
export const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
export const context = canvas.getContext("webgpu");
if (!context) throw new Error("Failed to create GPU canvas context");
context.configure({
	device: device,
	format: canvasFormat,
	alphaMode: "premultiplied",
});

