// import {expect} from "chai";
import PanoImageRendererForUnitTest from "../PanoImageRendererForUnitTest";
import {compare, createPanoImageRenderer} from "../util";
import WebGLUtils from "../../../src/PanoImageRenderer/WebGLUtils";
import PanoImageRendererForUnitTestInjector from "inject-loader!../PanoImageRendererForUnitTest";
import PanoImageRendererInjector from "inject-loader!../../../src/PanoImageRenderer/PanoImageRenderer";
import {glMatrix, quat} from "../../../src/utils/math-util.js";

import RendererInjector from "inject-loader!../../../src/PanoImageRenderer/renderer/Renderer";
import SphereRendererInjector from "inject-loader!../../../src/PanoImageRenderer/renderer/SphereRenderer";
import TestHelper from "../YawPitchControl/testHelper";

const RendererOnIE11 = RendererInjector(
	{
		"@egjs/agent": () => ({
			browser: {
				name: "ie",
				version: "11.0"
			}
		})
	}
).default;

const SphereRendererOnIE11 = SphereRendererInjector(
	{
		"./Renderer": RendererOnIE11
	}
).default;

const PanoImageRendererOnIE11 = PanoImageRendererInjector(
	{
		"./renderer/SphereRenderer": SphereRendererOnIE11
	}
).default;

const PanoImageRendererOnIE11ForTest = PanoImageRendererForUnitTestInjector(
	{
		"../../src/PanoImageRenderer/PanoImageRenderer": PanoImageRendererOnIE11
	}
).default;

const WEBGL_AVAILABILITY = WebGLUtils.isWebGLAvailable();
const IT = WEBGL_AVAILABILITY ? it : it.skip;
const USE_QUATERNION = true;

function promiseFactory(inst, yaw, pitch, fov, answerFile, threshold = 2, isQuaternion) {
	return new Promise(res => {
		// When
		if (isQuaternion) {
			const quaternion = quat.create();

			quat.rotateY(quaternion, quaternion, glMatrix.toRadian(-yaw));
			quat.rotateX(quaternion, quaternion, glMatrix.toRadian(-pitch));
			inst.renderWithQuaternion(quaternion, fov);
		} else {
			inst.render(yaw, pitch, fov);
		}

		// Then
		compare(answerFile, inst.canvas, (pct, data) => {
			expect(pct).to.be.below(threshold);
			res();
		});
	});
}

function renderAndCompareSequentially(inst, tests) {
	return new Promise(res => {
		tests.reduce(
			(promiseChain, currentTask) => promiseChain.then(() => promiseFactory(inst, ...currentTask)),
			Promise.resolve([])
		).then(res);
	});
}

const threshold = 3;

describe("PanoImageRenderer", () => {
	console.log(WEBGL_AVAILABILITY ? "gl available" : "no gl");
	const deviceRatio = window.devicePixelRatio;
	const suffix = `_${deviceRatio}x.png`;

	describe("#constructor", () => {
		IT("Instance", () => {
			// Given
			// When
			const inst = createPanoImageRenderer("./images/test_equi.png", false, "equirectangular");

			// Then
			expect(inst).to.be.exist;
		});
	});

	describe("#setImage", () => {
		IT("should fire error when image is invalid", done => {
			// Given
			const inst = createPanoImageRenderer(null, false, "equirectangular");

			// When
			inst.setImage({
				image: "./images/invalid.png"
			});

			// Then
			inst.on("error", () => done());
		});
	});

	describe("#isImageLoaded", () => {
		IT("should return false before image loaded", () => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.png";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			// When
			const isImageLoaded = inst.isImageLoaded();

			// Then
			expect(isImageLoaded).to.be.false;
		});

		IT("should return true after image loaded", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.png";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			inst.on("imageLoaded", () => {
				// When
				const isImageLoaded = inst.isImageLoaded();

				// Then
				expect(isImageLoaded).to.be.ok;
				done();
			});
		});

		IT("should return false when set another image after image loaded", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.png";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			inst.once("imageLoaded", () => {
				// When
				inst.setImage({
					image: "./images/test_equi_0_0_65.png"
				});
				const isImageLoaded = inst.isImageLoaded();

				// Then
				expect(isImageLoaded).to.be.false;
				done();
			});
		});

		IT("should return false when set another image before the first image loaded", () => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.png";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			// When
			inst.setImage({
				image: "./images/test_equi_0_0_65.png"
			});
			const isImageLoaded = inst.isImageLoaded();

			// Then
			expect(isImageLoaded).to.be.false;
		});
	});

	describe("adaptive devicePixelRatio", () => {
		IT("when devicePixelRatio is 1, should use 1", () => {
			// Given
			const MockedPanoImageRenderer = PanoImageRendererInjector({
				"../utils/browserFeature": {
					devicePixelRatio: 1
				}
			}).default;

			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";

			// When
			const inst = new MockedPanoImageRenderer(sourceImg, 200, 200, false, {
				initialYaw: 0,
				initialpitch: 0,
				imageType: "equirectangular",
				fieldOfView: 65
			});

			// Then
			expect(inst.canvas.width).to.be.equal(200);
			expect(inst.canvas.height).to.be.equal(200);
		});

		IT("when devicePixelRatio is 2, should use 2", () => {
			// Given
			const MockedPanoImageRenderer = PanoImageRendererInjector({
				"../utils/browserFeature": {
					devicePixelRatio: 2
				}
			}).default;

			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";

			// When
			const inst = new MockedPanoImageRenderer(sourceImg, 200, 200, false, {
				initialYaw: 0,
				initialpitch: 0,
				imageType: "equirectangular",
				fieldOfView: 65
			});

			// Then
			expect(inst.canvas.width).to.be.equal(400);
			expect(inst.canvas.height).to.be.equal(400);
		});

		IT("when devicePixelRatio is 3, should use 2", () => {
			// Given
			const MockedPanoImageRenderer = PanoImageRendererInjector({
				"../utils/browserFeature": {
					devicePixelRatio: 3
				}
			}).default;

			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";

			// When
			const inst = new MockedPanoImageRenderer(sourceImg, 200, 200, false, {
				initialYaw: 0,
				initialpitch: 0,
				imageType: "equirectangular",
				fieldOfView: 65
			});

			// Then
			expect(inst.canvas.width).to.be.equal(400);
			expect(inst.canvas.height).to.be.equal(400);
		});
	});

	describe("error event", () => {
		IT("Should trigger error event when invalis image url", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube_not_exist.jpg";

			// When
			const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

			inst.on("error", when);

			function when(e) {
				// Then
				expect(e.type).to.be.equal(12);
				done();
			}
		});
	});

	describe("renderingcontextlost / renderingcontextrestore event", () => {
		/**
		 * Skip this test after Chrome 69 update.
		 *
		 * it fails on Chrome Headless 69 of TRAVIS because "webglcontextlost" is not fired
		 * although webgl context is created more than 16.
		 *
		 * But it is working well on Chrome & Chrome Headless 69 of PC (Mac OS X)
		 */
		it.skip("Should trigger renderingcontextlost event when lost context", done => {
			// Given
			const REQUIRED_WEBGL_CONTEXT_COUNT_FOR_CONTEXT_LOST = 16;
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "cubemap");
			/**
			 * Cache the context. beacuse it can not be acquired after context-lost
			 * https://stackoverflow.com/questions/37186897/webglcontextrestored-event-not-firing-after-context-lost
			 */
			const loseContext = inst.context.getExtension("WEBGL_lose_context");
			let hasRenderingContextAfterLost;

			inst.on("renderingContextLost", () => {
				hasRenderingContextAfterLost = inst.hasRenderingContext();

				// Force restore context after context lost. It should be fired after some timeout.
				// https://stackoverflow.com/questions/28135551/webgl-context-lost-and-not-restored
				setTimeout(() => loseContext.restoreContext(), 100);
			});
			inst.on("renderingContextRestore", thenFunc);

			// When
			for (let i = 0; i < REQUIRED_WEBGL_CONTEXT_COUNT_FOR_CONTEXT_LOST; i++) {
				// Following code triggers webgl context lost.
				createPanoImageRenderer(sourceImg, false, "cubemap");
			}

			// Then
			function thenFunc(e) {
				expect(hasRenderingContextAfterLost).to.be.false;
				expect(inst.hasRenderingContext()).to.be.true;

				done();
			}
		});

		/**
		 * Above test case is replaced with following test case since Chrome 69 updates.
		 */
		IT("Should trigger renderingcontextlost event when lost context", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

			const loseContext = inst.context.getExtension("WEBGL_lose_context");
			let hasRenderingContextAfterLost;

			inst.on("renderingContextLost", () => {
				hasRenderingContextAfterLost = inst.hasRenderingContext();

				// Force restore context after context lost. It should be fired after some timeout.
				// https://stackoverflow.com/questions/28135551/webgl-context-lost-and-not-restored
				setTimeout(() => loseContext.restoreContext(), 100);
			});
			inst.on("renderingContextRestore", thenFunc);

			// When
			inst.forceContextLoss();

			// Then
			function thenFunc(e) {
				expect(hasRenderingContextAfterLost).to.be.false;
				expect(inst.hasRenderingContext()).to.be.true;

				done();
			}
		});
	});

	describe("render without throwing exception", () => {
		IT("Should not render internaly when calling render without image loaded", () => {
			// Given
			let isDrawCalled = false;
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube_not_exist.jpg";

			const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

			inst._draw = () => {
				isDrawCalled = true;
				PanoImageRenderer.prototype._draw.call(inst);
			};

			// When
			inst.render(0, 0, 65);

			// Then
			expect(isDrawCalled).to.be.equal(false);
		});
	});

	describe("Cubemap Rendering", () => {
		describe("separated tiles", () => {
			IT("multiple img url", done => {
				// Given
				const inst = createPanoImageRenderer([
					"./images/test_cube_r.png",
					"./images/test_cube_l.png",
					"./images/test_cube_u.png",
					"./images/test_cube_d.png",
					"./images/test_cube_b.png",
					"./images/test_cube_f.png"
				], false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("multiple img elements", done => {
				// Given
				const imgs = [
					"./images/test_cube_r.png",
					"./images/test_cube_l.png",
					"./images/test_cube_u.png",
					"./images/test_cube_d.png",
					"./images/test_cube_b.png",
					"./images/test_cube_f.png"
				].map(imgUrl => {
					const img = new Image();

					img.src = imgUrl;
					return img;
				});

				const inst = createPanoImageRenderer(imgs, false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("multiple img url: order", done => {
				// Given
				const inst = createPanoImageRenderer([
					"./images/test_cube_l.png",
					"./images/test_cube_r.png",
					"./images/test_cube_u.png",
					"./images/test_cube_b.png",
					"./images/test_cube_d.png",
					"./images/test_cube_f.png"
				], false, "cubemap", {
					order: "LRUBDF", // RLUDBF,
					tileConfig: [
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0}
					]
				});

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("multiple img url: flip", done => {
				// Given
				const cubemapConfig = {
					tileConfig: [
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: false, rotation: 0},
						{flipHorizontal: true, rotation: 0}
					]
				};
				const inst = createPanoImageRenderer([
					"./images/test_cube_r.png",
					"./images/test_cube_l.png",
					"./images/test_cube_u.png",
					"./images/test_cube_d.png",
					"./images/test_cube_b.png",
					"./images/test_cube_f_hflip.png"
				], false, "cubemap", cubemapConfig);

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("multiple img url: flip rotation", done => {
				// Given
				const cubemapConfig = {
					tileConfig: [
						{flipHorizontal: true, rotation: 0},
						{flipHorizontal: true, rotation: 0},
						{flipHorizontal: true, rotation: 180},
						{flipHorizontal: true, rotation: 180},
						{flipHorizontal: true, rotation: 0},
						{flipHorizontal: true, rotation: 0}
					]
				};
				const inst = createPanoImageRenderer([
					"./images/test_cube_r_hflip.png",
					"./images/test_cube_l_hflip.png",
					"./images/test_cube_u_hflip_180.png",
					"./images/test_cube_d_hflip_180.png",
					"./images/test_cube_b_hflip.png",
					"./images/test_cube_f_hflip.png"
				], false, "cubemap", cubemapConfig);

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});
		});

		describe("cubestrip", () => {
			IT("cubestrip 1x6", done => {
				// Given
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_1x6_LRUDBF.jpg";
				const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, 2],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, 2],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, 2],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, 2],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, 2],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, 2]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 1x6: flip rotate", done => {
				// Given
				const tileConfigForCubestrip = {flipHorizontal: true, rotation: 0};
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_1x6_naver.jpg";
				const inst = createPanoImageRenderer(sourceImg, false, "cubemap", {
					tileConfig: tileConfigForCubestrip
				});

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 1x6: rotate", done => {
				// Given
				const tileConfigForCubestrip = [
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 180},
					{flipHorizontal: false, rotation: 180}
				];
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_1x6_krpano.jpg";

				const inst = createPanoImageRenderer(sourceImg, false, "cubemap", {
					order: "LFRBUD",
					tileConfig: tileConfigForCubestrip
				});

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 3x2", done => {
				// Given
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_3x2_LRUDBF.jpg";

				const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			// This test will fail on iOS safari, because video will not start load with out use interaction.
			IT("cubestrip 3x2: video", done => {
				// Given
				const isVideo = true;
				const video = document.createElement("video");

				video.src = "./images/test_cube_3x2_LRUDBF.mp4";
				video.setAttribute("crossorigin", "anonymous");
				video.setAttribute("webkit-playsinline", "");
				video.setAttribute("playsinline", "");

				const inst = createPanoImageRenderer(video, isVideo, "cubemap");

				video.addEventListener("loadeddata", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, 6],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, 6],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, 6],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, 6],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, 6],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, 6]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 2x3", done => {
				// Given
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_2x3_LRUDBF.jpg";

				const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 6x1", done => {
				// Given
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_6x1_LRUDBF.jpg";
				const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});

			IT("cubestrip 6x1: flip", done => {
				// Given
				const tileConfigForCubestrip = [
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 0},
					{flipHorizontal: false, rotation: 180},
					{flipHorizontal: false, rotation: 180}
				];
				const sourceImg = new Image();

				sourceImg.src = "./images/test_cube_6x1_krpano.jpg";

				const inst = createPanoImageRenderer(sourceImg, false, "cubemap", {
					tileConfig: tileConfigForCubestrip,
					order: "LFRBUD"
				});

				inst.on("imageLoaded", when);

				function when() {
					// When
					inst.bindTexture()
						.then(() => {
							// Then
							renderAndCompareSequentially(
								inst,
								[
									[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
									[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
									[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
									[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
									[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
									[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
								]
							).then(() => {
								done();
							});
						});
				}
			});
		});
	});

	describe("Equirectangular Rendering with yaw / pitch", () => {
		IT("should render properly by yaw, pitch, fov", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
							]
						).then(done);
					});
			}
		});


		IT("yaw: 0, pitch:0, fov:65 : IE11", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";
			const inst = new PanoImageRendererOnIE11ForTest(sourceImg, 200, 200, false, {
				imageType: "equirectangular",
				fieldOfView: 65
			});

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
							]
						).then(() => {
							done();
						});
					});
			}
		});

		IT("yaw: 0, pitch:0, fov:65 : video IE11", done => {
			// Given
			const sourceImg = document.createElement("video");

			sourceImg.src = "./images/test_equi.mp4";
			sourceImg.load();
			const isVideo = true;
			const thresholdMargin = 4; /* Exceptional Case */

			const inst = new PanoImageRendererOnIE11ForTest(sourceImg, 200, 200, isVideo, {
				imageType: "equirectangular",
				fieldOfView: 65
			});

			// inst.on("imageLoaded", when); // 2018.02.26. imageLoaded does not gaurantee video is playable. (spec changed)
			sourceImg.addEventListener("loadeddata", when);

			function when(e) {
				// When
				inst.bindTexture()
					.then(() => {
						console.log("video loaded");

						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold + thresholdMargin],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold + thresholdMargin],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold + thresholdMargin],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold + thresholdMargin],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold + thresholdMargin],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold + thresholdMargin]
							]
						).then(() => {
							done();
						});
					});
			}
		});

		IT("yaw: 0, pitch:0, fov:65 : video IE11 change video size after loaded", done => {
			// Given
			const sourceImg = document.createElement("video");

			sourceImg.src = "./images/test_equi_512.mp4";
			sourceImg.load();
			const isVideo = true;
			const thresholdMargin = 4; /* Exceptional Case */

			const inst = new PanoImageRendererOnIE11ForTest(sourceImg, 200, 200, isVideo, {
				imageType: "equirectangular",
				fieldOfView: 65
			});

			// inst.once("imageLoaded", onFirstLoad); // 2018.02.26. imageLoaded does not gaurantee video is playable. (spec changed)
			TestHelper.once(sourceImg, "loadeddata", onFirstLoad)

			function onFirstLoad() {
				inst.bindTexture()
					.then(() => {
						// When
						TestHelper.once(sourceImg, "loadeddata", when);
						sourceImg.src = "./images/test_equi.mp4";
					});
			}

			function when() {
				// Then
				renderAndCompareSequentially(
					inst,
					[
						[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold + thresholdMargin],
						[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold + thresholdMargin],
						[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold + thresholdMargin],
						[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold + thresholdMargin],
						[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold + thresholdMargin],
						[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold + thresholdMargin]
					]
				).then(() => {
					done();
				});
			}
		});

		IT("yaw: 0, pitch:0, fov:65 : video", done => {
			// Given
			const sourceImg = document.createElement("video");

			sourceImg.src = "./images/test_equi.mp4";
			sourceImg.load();
			const isVideo = true;
			const thresholdMargin = 4; /* Exceptional Case */

			const inst = createPanoImageRenderer(sourceImg, isVideo, "equirectangular");

			// inst.on("imageLoaded", when); // 2018.02.26. imageLoaded does not gaurantee video is playable. (spec changed)
			sourceImg.addEventListener("loadeddata", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						console.log("video loaded");

						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold + thresholdMargin],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold + thresholdMargin],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold + thresholdMargin],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold + thresholdMargin],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold + thresholdMargin],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold + thresholdMargin]
							]
						).then(() => {
							done();
						});
					});
			}
		});

		IT("yaw: 0, pitch:0, fov:65 -> 30", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						inst.render(0, 0, 65);
						inst.render(0, 0, 30);
						// Then
						compare(`./images/PanoViewer/test_equi_0_0_30${suffix}`, inst.canvas, pct => {
							expect(pct).to.be.below(threshold);
							done();
						});
					});
			}
		});
	});

	describe("#keepUpdate", () => {
		IT("Should not render internaly when calling render when it doesn't need.", done => {
			// Given
			let isDrawCalled = false;
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube.jpg";

			const inst = createPanoImageRenderer(sourceImg, false, "cubemap");

			inst.on("imageLoaded", () => {
				inst.render(0, 0, 65);
				inst._draw = () => {
					isDrawCalled = true;
					PanoImageRendererForUnitTest.prototype._draw.call(inst);
				};

				// When
				inst.keepUpdate(false);
				inst.render(0, 0, 65);

				// Then
				expect(isDrawCalled).to.be.equal(false);
				done();
			});
		});

		IT("should not update video texture after keepUpdate(false) called", done => {
			// Given
			const sourceImg = document.createElement("video");

			sourceImg.src = "./images/PanoViewer/pano.mp4";
			sourceImg.play();
			const isVideo = true;
			const threshold = 7;

			const inst = createPanoImageRenderer(sourceImg, isVideo, "equirectangular");

			sourceImg.addEventListener("loadeddata", when);

			function when() {
				inst.bindTexture()
					.then(() => {
						// When
						inst.keepUpdate(false);

						setTimeout(() => {
							// Then
							renderAndCompareSequentially(
								inst, [[0, 0, 65, `./images/PanoViewer/pano_0_0_65${suffix}`, threshold]]
							).then(done);
						}, 1000);
					});
			}
		});
	});

	describe("Cubemap Rendering with Quaternion", () => {
		IT("should render by quaternion in cubemap mode", done => {
			// Given
			const tileConfigForCubestrip = {flipHorizontal: true, rotation: 0};
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube_1x6_naver.jpg";

			const inst = createPanoImageRenderer(sourceImg, false, "cubemap", {
				tileConfig: tileConfigForCubestrip
			});

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold, USE_QUATERNION],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold, USE_QUATERNION],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold, USE_QUATERNION],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold, USE_QUATERNION],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold, USE_QUATERNION],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold, USE_QUATERNION]
							]
						).then(done);
					});
			}
		});
	});

	describe("Equirectangular Rendering with Quaternion", () => {
		IT("should render by quaternion in equirectangular mode", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_equi.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "equirectangular");

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold, USE_QUATERNION],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold, USE_QUATERNION],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold, USE_QUATERNION],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold, USE_QUATERNION],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold, USE_QUATERNION],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold, USE_QUATERNION]
							]
						).then(() => {
							done();
						});
					});
			}
		});
	});

	describe("CubeStrip Rendering (Only 3x2 is supported currently)", () => {
		/**
		 * This order (RLUDFB) is the way Facebook 3x2 Cubemap, Three.js, forgejs uses
		 */
		IT("should use order RLUDFB (default)", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube_3x2_RLUDFB.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "cubestrip");

			inst.on("imageLoaded", when);

			// inst.attachTo(target);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
								/**
								 * We use reversed image because the bottom & up is rendered differently with ProjectionType.CUBEMAP
								 * But CUBESTRIP is more general way to project on cube
								 */
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90_reverse${suffix}`, threshold],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90_reverse${suffix}`, threshold]
							]
						).then(done);
					});
			}
		});

		IT("should support cubemap order(RLUDBF), apply rotation on some faces.", done => {
			// Given
			const sourceImg = new Image();

			sourceImg.src = "./images/test_cube_3x2_LRUDBF.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "cubestrip", {
				order: "RLUDBF",
				tileConfig: [{rotation: 0}, {rotation: 0}, {rotation: 180}, {rotation: 180}, {rotation: 0}, {rotation: 0}]
			});

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/test_cube_0_0_90${suffix}`, threshold],
								[90, 0, 90, `./images/PanoViewer/test_cube_90_0_90${suffix}`, threshold],
								[180, 0, 90, `./images/PanoViewer/test_cube_180_0_90${suffix}`, threshold],
								[270, 0, 90, `./images/PanoViewer/test_cube_270_0_90${suffix}`, threshold],
								[0, 90, 90, `./images/PanoViewer/test_cube_0_90_90${suffix}`, threshold + 1],
								[0, -90, 90, `./images/PanoViewer/test_cube_0_-90_90${suffix}`, threshold]
							]
						).then(done);
					});
			}
		});

		IT("should support YouTube cubemap format(EAC)", done => {
			// Given
			const sourceImg = new Image();

			// Source: https://www.youtube.com/watch?v=8RadEwX29pA ([360 VR] 힐링에세이 ‘쉼표’ _ 경희궁(Gyeonghuigung Palace 慶熙宮) 편)
			sourceImg.src = "./images/PanoViewer/EAC/EAC_1280x720.jpg";
			const inst = createPanoImageRenderer(sourceImg, false, "cubestrip", {
				order: "BLFDRU",
				tileConfig:
					[{rotation: 0}, {rotation: 0}, {rotation: 0}, {rotation: 0}, {rotation: -90}, {rotation: 180}]
			}, {width: 300, height: 300});

			inst.on("imageLoaded", when);

			function when() {
				// When
				inst.bindTexture()
					.then(() => {
						// Then
						renderAndCompareSequentially(
							inst,
							[
								[0, 0, 90, `./images/PanoViewer/EAC/EAC_1280x720_0_0_90${suffix}`, threshold],
								[90, 0, 90, `./images/PanoViewer/EAC/EAC_1280x720_90_0_90${suffix}`, threshold],
								[180, 0, 90, `./images/PanoViewer/EAC/EAC_1280x720_180_0_90${suffix}`, threshold],
								[270, 0, 90, `./images/PanoViewer/EAC/EAC_1280x720_270_0_90${suffix}`, threshold],
								[0, 90, 90, `./images/PanoViewer/EAC/EAC_1280x720_0_90_90${suffix}`, threshold],
								[0, -90, 90, `./images/PanoViewer/EAC/EAC_1280x720_0_-90_90${suffix}`, threshold]
							]
						).then(done);
					});
			}
		});
	});
});
