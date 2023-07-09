const STAR_COUNT = 115;
const STAR_SIZE = 3;
const THRESHOLD = 250.0;
const SPEED_MULTIPLIER = 2.5;

const STAR_COLOR = [0.898, 0.89, 0.8745];
const BACKGROUND_COLOR = [0.0627, 0.0706, 0.0706];

const WORKGROUP_SIZE = 8;
let step = 0;


const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("No <canvas> element found");
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;
canvas.width = 512;
canvas.height = 512;


if (!navigator.gpu) {
	throw new Error("Failed to access the WebGPU API");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
	throw new Error("No supported GPU adapter found");
}

const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
if (!context) throw new Error("Failed to create GPU canvas context");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
	device: device,
	format: canvasFormat,
});


const starShaderModule = device.createShaderModule({
	label: "Stars render shader",
	code: /* wgsl */`
		struct VertexInput {
			@location(0) pos: vec2f,
			@builtin(instance_index) instance: u32,
		};

		struct VertexOutput {
			@builtin(position) pos: vec4f,
		};

		@group(0) @binding(0) var<storage> states: array<vec4f, ${STAR_COUNT}>;


		// x, y, z, w
		@vertex
		fn vertexMain(in: VertexInput) -> VertexOutput {
			var out: VertexOutput;
			out.pos = vec4f(states[in.instance].xy + in.pos, 0, 1);
			return out;
		}


		// r, g, b, a
		@fragment
		fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
			// Circlular alpha mask
			let alpha = max(1.0 - length(in.pos), 0.0);
			return vec4f(${STAR_COLOR.join(",")}, alpha);
		}
	`
});


const simulationShaderModule = device.createShaderModule({
	label: "Constellations simulation shader",
	code: /* wgsl */ `
		@group(0) @binding(0) var<storage> statesIn: array<vec4f, ${STAR_COUNT}>;
		@group(0) @binding(1) var<storage, read_write> statesOut: array<vec4f, ${STAR_COUNT}>;

		@compute
		@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
		fn computeMain(@builtin(global_invocation_id) star: vec3u) {
			statesOut[star.x] = statesIn[star.x];
		}
	`
});


// A square to instance all of the stars from
// TODO: Render a circle instead
const vertexX = STAR_SIZE / canvas.width / 2;
const vertexY = STAR_SIZE / canvas.height / 2;
const vertices = new Float32Array([
	-vertexX, -vertexY,
	 vertexX, -vertexY,
	 vertexX,  vertexY,

	-vertexX, -vertexY,
	 vertexX,  vertexY,
	-vertexX,  vertexY,
]);

const vertexBuffer = device.createBuffer({
	label: "Star vertices",
	size: vertices.byteLength,
	usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertices);

const vertexBufferLayout = {
	arrayStride: 8,
	attributes: [
		{
			format: "float32x2",
			offset: 0,
			shaderLocation: 0,
		},
	],
};


function randomPosition() {
	return Math.random() * 2 - 1;
}

function randomVelocity() {
	return 0.03;  // TODO
}

// The x and y position and velocity of each star
const starStateArray = new Float32Array(STAR_COUNT * 4);
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
	starStateArray[i+2] = randomVelocity();
	starStateArray[i+3] = randomVelocity();
}
device.queue.writeBuffer(starStateStorage[0], 0, starStateArray);


const bindGroupLayout = device.createBindGroupLayout({
	label: "Star bind group layout",
	entries: [
		{
			// Star state input buffer
			binding: 0,
			visibility: GPUShaderStage.VERTEX |
			            GPUShaderStage.FRAGMENT |
			            GPUShaderStage.COMPUTE,
			buffer: { type: "read-only-storage" }
		},
		{
			// Star state output buffer
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: { type: "storage" }
		}
	]
});

const bindGroups = [
	device.createBindGroup({
		label: "Star renderer bind group A",
		layout: bindGroupLayout,
		entries: [
			{
				binding: 0,
				resource: { buffer: starStateStorage[0] },
			},
			{
				binding: 1,
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
				resource: { buffer: starStateStorage[1] },
			},
			{
				binding: 1,
				resource: { buffer: starStateStorage[0] },
			},
		],
	}),
];


const pipelineLayout = device.createPipelineLayout({
	label: "Star pipeline layout",
	bindGroupLayouts: [bindGroupLayout],
});

const starPipeline = device.createRenderPipeline({
	label: "Star pipeline",
	layout: pipelineLayout,
	vertex: {
		module: starShaderModule,
		entryPoint: "vertexMain",
		buffers: [vertexBufferLayout]
	},
	fragment: {
		module: starShaderModule,
		entryPoint: "fragmentMain",
		targets: [{
			format: canvasFormat
		}]
	},
});

const simulationPipeline = device.createComputePipeline({
	label: "Simulation pipeline",
	layout: pipelineLayout,
	compute: {
		module: simulationShaderModule,
		entryPoint: "computeMain",
	},
});


function tick() {
	const encoder = device.createCommandEncoder();

	{
		const pass = encoder.beginComputePass();
	
		pass.setPipeline(simulationPipeline);
		pass.setBindGroup(0, bindGroups[step % 2]);
	
		const workgroupCount = Math.ceil(STAR_COUNT / WORKGROUP_SIZE);
		pass.dispatchWorkgroups(workgroupCount);
	
		pass.end();
	}

	++step;
	
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
		pass.setBindGroup(0, bindGroups[step % 2]);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 2, STAR_COUNT);
	
		pass.end();
	}

	device.queue.submit([encoder.finish()]);
	requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
