import {
	WORKGROUP_SIZE
} from "./constants.js";
import wgslRenderCode from "./render.wgsl.js";
import wgslComputeCode from "./compute.wgsl.js";
import { canvasFormat, context, device } from "./canvas.js";
import { uniforms, uniformBuffer } from "./uniforms.wgsl.js";

const BACKGROUND_COLOR = [0.0627, 0.0706, 0.0706];


function aspect_ratio() {
	return uniforms.res[0] / uniforms.res[1];
}

const star_width = uniforms.star_radius / aspect_ratio();
const star_height = uniforms.star_radius;
console.debug("Star width:", star_width, "Star height:", star_height);

const vertices = new Float32Array([
	-star_width, -star_height,
	 star_width, -star_height,
	 star_width,  star_height,

	-star_width, -star_height,
	 star_width,  star_height,
	-star_width,  star_height,
]);

const vertexBuffer = device.createBuffer({
	label: "Star vertices",
	// size: vertices.byteLength,
	size: vertices.byteLength,
	usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);


function randomPosition() {
	return Math.random() * 2 - 1;  // clip space
}

// Generate a value with a magnitude between [0.001953125, 0.0625],
// negative half the time, and with a bias toward 0.
// https://www.desmos.com/calculator/7uspuyiuu5
function randomVelocity() {
	return Math.pow(0.2, Math.random() * 4 + 3) * (Math.random() < 0.5 ? -1 : 1);
}

// The x and y position and velocity of each star
const starStateArray = new Float32Array(uniforms.star_count * 4);
const starStateStorage = [
	device.createBuffer({
		label: "Star positions A",
		size: starStateArray.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	}),
	device.createBuffer({
		label: "Star positions B",
		size: starStateArray.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
];

for (let i = 0; i < starStateArray.length; i += 4) {
	starStateArray[i  ] = randomPosition();
	starStateArray[i+1] = randomPosition();
	starStateArray[i+2] = randomVelocity() / aspect_ratio();
	starStateArray[i+3] = randomVelocity();
}
device.queue.writeBuffer(starStateStorage[0], 0, starStateArray);

const bindGroupLayout = device.createBindGroupLayout({
	label: "Star bind group layout",
	entries: [
		{
			// Uniforms
			binding: 0,
			visibility: GPUShaderStage.VERTEX |
			            GPUShaderStage.FRAGMENT |
			            GPUShaderStage.COMPUTE,
			buffer: {}
		},
		{
			// Star state input buffer
			binding: 1,
			visibility: GPUShaderStage.VERTEX |
			            GPUShaderStage.FRAGMENT |
			            GPUShaderStage.COMPUTE,
			buffer: { type: "read-only-storage" }
		},
		{
			// Star state output buffer
			binding: 2,
			visibility: GPUShaderStage.COMPUTE,
			buffer: { type: "storage" }
		},
	]
});

const bindGroups = [
	device.createBindGroup({
		label: "Star renderer bind group A",
		layout: bindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: { buffer: uniformBuffer },
			},
			{
				binding: 1,
				resource: { buffer: starStateStorage[0] },
			},
			{
				binding: 2,
				resource: { buffer: starStateStorage[1] },
			},
		],
	}),
	device.createBindGroup({
		label: "Star renderer bind group B",
		layout: bindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: { buffer: uniformBuffer },
			},
			{
				binding: 1,
				resource: { buffer: starStateStorage[1] },
			},
			{
				binding: 2,
				resource: { buffer: starStateStorage[0] },
			},
		],
	}),
];


const pipelineLayout = device.createPipelineLayout({
	label: "Star pipeline layout",
	bindGroupLayouts: [bindGroupLayout],
});

const starShaderModule = device.createShaderModule({
	label: "Stars render shader",
	code: wgslRenderCode
});

const starPipeline = device.createRenderPipeline({
	label: "Star pipeline",
	layout: pipelineLayout,
	vertex: {
		module: starShaderModule,
		entryPoint: "vertex_main",
		buffers: [{
			arrayStride: 8,
			attributes: [
				{
					format: "float32x2",
					offset: 0,
					shaderLocation: 0,
				},
			],
		}]
	},
	fragment: {
		module: starShaderModule,
		entryPoint: "fragment_main",
		targets: [{
			format: canvasFormat,
			blend: {  // WebGPU ignores alpha by default??? Why???
				color: {
					srcFactor: "src-alpha",
					dstFactor: "one",
					operation: "add",
				},
				alpha: {
					srcFactor: "zero",
					dstFactor: "one",
					operation: "add",
				},
			},
		}]
	},
});

const simulationPipeline = device.createComputePipeline({
	label: "Simulation pipeline",
	layout: pipelineLayout,
	compute: {
		module: device.createShaderModule({
			label: "Constellations simulation shader",
			code: wgslComputeCode
		}),
		entryPoint: "compute_main",
	},
});


tick.count = 0;
function tick() {
	const encoder = device.createCommandEncoder();

	{
		const pass = encoder.beginComputePass();
	
		pass.setPipeline(simulationPipeline);
		pass.setBindGroup(0, bindGroups[tick.count % 2]);
	
		const workgroupCount = Math.ceil(uniforms.star_count / WORKGROUP_SIZE);
		pass.dispatchWorkgroups(workgroupCount);
	
		pass.end();
	}

	++tick.count;

	{
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(),
					loadOp: "clear",
					clearValue: [...BACKGROUND_COLOR, 1],
					storeOp: "store",
				}
			]
		});
	
		pass.setPipeline(starPipeline);
		pass.setBindGroup(0, bindGroups[tick.count % 2]);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 2, uniforms.star_count);
	
		pass.end();
	}

	device.queue.submit([encoder.finish()]);
	requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
