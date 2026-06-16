import * as THREE from 'three';
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MlMap,
} from 'maplibre-gl';
import { buildCar } from './car';
import type { BikeController } from './BikeController';

/** Render the car a little larger than life so it reads clearly at street zoom. */
const AVATAR_SCALE = 1.8;

/**
 * A MapLibre custom layer that renders the three.js cyclist into the map's own
 * WebGL camera, so the avatar stays locked to real-world coordinates while the
 * map draws the streets and 3D buildings beneath it.
 *
 * The model is built Z-up (matching mercator world space), so no axis swap is
 * needed — only a north/south flip baked into the scale, plus a steering
 * rotation about the vertical (Z) axis.
 */
export class AvatarLayer implements CustomLayerInterface {
  id = 'cyclist-avatar';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera = new THREE.Camera();
  private car!: THREE.Group;
  private wheels: THREE.Object3D[] = [];
  private controller: BikeController;

  constructor(controller: BikeController) {
    this.controller = controller;
  }

  onAdd(map: MlMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;

    this.scene = new THREE.Scene();

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-70, -120, 100).normalize();
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));

    this.car = buildCar();
    this.car.traverse((o) => {
      if (o.name === 'wheel') this.wheels.push(o);
    });
    this.scene.add(this.car);

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const s = this.controller.state;

    // Place + steer the car at its live position.
    const mc = MercatorCoordinate.fromLngLat([s.lng, s.lat], 0);
    const scale = mc.meterInMercatorCoordinateUnits() * AVATAR_SCALE;

    // Heading is clockwise from north; rotate the (north-facing) model to match.
    this.car.rotation.z = -s.heading;

    // Roll the wheels about their axle (X) for a sense of motion.
    for (const w of this.wheels) w.rotation.x += s.speed * 0.12;

    const model = new THREE.Matrix4()
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new THREE.Vector3(scale, -scale, scale));

    const mvp = new THREE.Matrix4().fromArray(Array.from(args.defaultProjectionData.mainMatrix));
    this.camera.projectionMatrix = mvp.multiply(model);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}
