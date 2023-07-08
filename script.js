const PARTICLE_COUNT = 115;
const PARTICLE_SIZE = 3;
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

		@group(0) @binding(0) var<storage> starState: array<f32>;


		// x, y, z, w
		@vertex
		fn vertexMain(input: VertexInput) -> VertexOutput {
			var output: VertexOutput;
			output.pos = input.pos;
			return output;
		}


		// r, g, b, a
		@fragment
		fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
			return vec4f(${STAR_COLOR.join(",")}, 1);
		}
	`
});


const simulationShaderModule = device.createShaderModule({
	label: "Constellations simulation shader",
	code: /* wgsl */ `
		@group(0) @binding(0) var<storage> starStateIn: array<f32>;
		@group(0) @binding(1) var<storage, read_write> starStateOut: array<f32>;

		@compute
		@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
		fn computeMain(@builtin(global_invocation_id) star: vec3u) {
			starStateOut[i] = starStateIn[i];
		}
	`
});


// A square to instance all of the stars from
// TODO: Render a circle instead
const vertexX = PARTICLE_SIZE / canvas.width / 2;
const vertexY = PARTICLE_SIZE / canvas.height / 2;
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

// The x and y positions of each star
const starStateArray = new Float32Array(PARTICLE_COUNT * 2);
const starStateStorage = [
	device.createBuffer({
		label: "Star state A",
		size: starStateArray.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	}),
	device.createBuffer({
		label: "Star state B",
		size: starStateArray.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
];

for (let i = 0; i < starStateArray.length; i++) {
	starStateArray[i] = Math.random() * 2 - 1;
}
device.queue.writeBuffer(starStateStorage[0], 0, starStateArray);


const bindGroupLayout = device.createBindGroupLayout({
	label: "Star bind group layout",
	entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.VERTEX |
			            GPUShaderStage.FRAGMENT |
			            GPUShaderStage.COMPUTE,
			buffer: { type: "read-only-storage" }  // Star state input buffer
		},
		{
			binding: 1,
			visibility: GPUShaderStage.COMPUTE,
			buffer: { type: "storage" }  // Star state output buffer
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


requestAnimationFrame(function updateGrid() {
	// if (!document.hasFocus()) return;
	const encoder = device.createCommandEncoder();

	{
		const pass = encoder.beginComputePass();
	
		pass.setPipeline(simulationPipeline);
		pass.setBindGroup(0, bindGroups[step % 2]);
	
		const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
		pass.dispatchWorkgroups(workgroupCount, workgroupCount);
	
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
		pass.draw(vertices.length / 2, PARTICLE_COUNT);
	
		pass.end();
	}

	device.queue.submit([encoder.finish()]);
	requestAnimationFrame(updateGrid);
});