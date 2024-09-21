/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-var */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import {
  PointerEventTypes,
  PointerInfo,
} from "@babylonjs/core/Events/pointerEvents";
import { WebXRManagedOutputCanvasOptions } from "@babylonjs/core/XR";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import {
  AssetsManager,
  MeshAssetTask,
  MeshBuilder,
  StandardMaterial,
  HighlightLayer,
} from "@babylonjs/core";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HemisphericLight, DirectionalLight } from "@babylonjs/core/Lights";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/inspector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private highlightLayer: HighlightLayer;
  private cameraPosition: Vector3;
  private camera: UniversalCamera;
  private thumbstickAxis: Vector3 = new Vector3(0, 0, 0);
  private movementSpeed: number = 0.1;
  private isAButtonPreesing: boolean = false;
  private isBButtonPreesing: boolean = false;
  private isXButtonPreesing: boolean = false;
  private isYButtonPreesing: boolean = false;
  private isSqueezePreesing: boolean = false;
  private isTriggerPreesing: boolean = false;
  private acceleration: number = 0.001; 
  private currentYVelocity: number = 0;
  private currentXZVelocity: Vector3 = new Vector3(0, 0, 0);
  private remainingDeltaV = 100;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.highlightLayer = new HighlightLayer("highlightLayer", this.scene);
    this.cameraPosition = new Vector3(0, 1.6, 0);
    this.camera = new UniversalCamera("camera1", this.cameraPosition, this.scene);
  }

  start(): void {
    this.createScene().then(() => {
      this.engine.runRenderLoop(() => {
        this.scene.render();
      });

      window.addEventListener("resize", () => {
        this.engine.resize();
      });
    });
  }

  private consumeDeltaV(): void {
    this.remainingDeltaV -= this.acceleration * 10;
    if (this.remainingDeltaV <= 0) {
      this.remainingDeltaV = 0;
    }
  }

  private updateDeltaVTextMesh(newValue: number) {
    const textPlane = this.scene.getMeshByName("textPlane");
    if (!textPlane) {
      console.error("Text plane mesh not found.");
      return;
    }
    const material = textPlane.material as StandardMaterial;
    if (material && material.diffuseTexture) {
      const dynamicTexture = material.diffuseTexture as DynamicTexture;
      dynamicTexture.clear();
      dynamicTexture.drawText("DeltaV: " + newValue.toFixed(2).toString() + " m/s", null, null, "bold 44px Arial", "#FFFFFF", "#00000000", true);
    } else {
      console.error("Material or diffuseTexture not found.");
    }
  }

  private async createScene() {
    this.camera.fov = (90 * Math.PI) / 180;
    this.camera.attachControl(this.canvas, true);

    var canvasOptions = WebXRManagedOutputCanvasOptions.GetDefaults();
    canvasOptions.canvasOptions!.stencil = true;

    const xrHelper = await this.scene.createDefaultXRExperienceAsync({
      outputCanvasOptions: canvasOptions,
    });
    xrHelper.teleportation.setSelectionFeature(
      xrHelper.baseExperience.featuresManager.getEnabledFeature(
        "xr-background-remover"
      )
    );

    this.scene.onPointerObservable.add((pointerInfo) => {
      this.processPointer(pointerInfo);
    });

    xrHelper.input.onControllerAddedObservable.add((controller) => {
      this.onControllerAdded(controller);
    });

    xrHelper.input.onControllerRemovedObservable.add((controller) => {
      this.onControllerRemoved(controller);
    });

    // update every frame
    this.scene.onBeforeRenderObservable.add(() => {

      if(this.remainingDeltaV > 0){
        // move up with b/y button
        if(this.isBButtonPreesing || this.isYButtonPreesing){
          this.currentYVelocity += this.acceleration;
          this.consumeDeltaV();
        }
        // move down with a/x button
        if(this.isAButtonPreesing || this.isXButtonPreesing){
          this.currentYVelocity -= this.acceleration;
          this.consumeDeltaV();
        }

        // move horizontally with thumbstick & holding squeeze
        if(this.isSqueezePreesing){
          // disable snap turn
          xrHelper.teleportation.rotationEnabled = false;
          xrHelper.teleportation.rotationAngle = 0;

          this.currentXZVelocity.addInPlace(new Vector3(this.thumbstickAxis.x*this.acceleration, 0, -this.thumbstickAxis.y*this.acceleration));
          if(this.thumbstickAxis.x != 0 || this.thumbstickAxis.y != 0){
            this.consumeDeltaV();
          }
        }else{
          // enable snap turn
          xrHelper.teleportation.rotationEnabled = true;
          xrHelper.teleportation.rotationAngle = Math.PI/8;
        }

        // hold squeeze & trigger to stop movement
        if(this.isSqueezePreesing && this.isTriggerPreesing && (this.currentXZVelocity.x != 0 || this.currentXZVelocity.z != 0 || this.currentYVelocity != 0)){
          // stop y-axis movement
          if(this.currentYVelocity > 0){
            this.currentYVelocity -= this.acceleration;
            this.consumeDeltaV();
          }else{
            this.currentYVelocity += this.acceleration;
            this.consumeDeltaV();
          }
          // stop xz-axis movement
          if(this.currentXZVelocity.x > 0){
            this.currentXZVelocity.x -= this.acceleration;
            this.consumeDeltaV();
          }else{
            this.currentXZVelocity.x += this.acceleration;
            this.consumeDeltaV();
          }
          if(this.currentXZVelocity.z > 0){
            this.currentXZVelocity.z -= this.acceleration;
            this.consumeDeltaV();
          }else{
            this.currentXZVelocity.z += this.acceleration;
            this.consumeDeltaV();
          }
        }
      }

      this.updateDeltaVTextMesh(this.remainingDeltaV);
      // update camera position
      this.cameraPosition.addInPlace(new Vector3(this.currentXZVelocity._x, this.currentYVelocity, this.currentXZVelocity._z));
      if (xrHelper.baseExperience.camera) {
        xrHelper.baseExperience.camera.position.copyFrom(this.cameraPosition);
      }
    });

    var assetsManager = new AssetsManager(this.scene);

    // Lights
    // hemispheric light (ambient light)
    var hemiLight = new HemisphericLight(
      "hemiLight",
      new Vector3(0, 3, 0),
      this.scene
    );
    hemiLight.intensity = 1;
    // directional light
    var dirLight = new DirectionalLight(
      "dirLight",
      new Vector3(-1, -2, -1),
      this.scene
    );
    dirLight.position = new Vector3(20, 40, 20);
    dirLight.intensity = 1;

    // Skybox
    var skybox = MeshBuilder.CreateBox("skybox", { size: 10000.0 }, this.scene);
    var skyboxMaterial = new StandardMaterial("skybox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.reflectionTexture = new CubeTexture(
      "textures/skybox/skybox",
      this.scene,
      ["_px.png", "_py.png", "_pz.png", "_nx.png", "_ny.png", "_nz.png"]
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;

    var friendUnitRoot = new TransformNode("friendUnitRoot", this.scene);
    this.addMeshTask(
      assetsManager,
      "friendUnit",
      "assets/models/",
      "solaris_class_close_combat_destroyer.glb",
      new Vector3(10, 10, 10),
      new Vector3(0, 0, 0),
      new Vector3(1, 1, 1),
      friendUnitRoot
    );
    this.addMeshTask(
      assetsManager,
      "friendUnit2",
      "assets/models/",
      "astroferros_light_onsite_collection_craft.glb",
      new Vector3(0, -20, 20),
      new Vector3(0, 0, 0),
      new Vector3(0.1, 0.1, 0.1),
      friendUnitRoot
    );

    var enemyUnitRoot = new TransformNode("enemyUnitRoot", this.scene);
    this.addMeshTask(
      assetsManager,
      "enemyUnit",
      "assets/models/",
      "jovian_retribution_class_destroyer.glb",
      new Vector3(300, -50, 300),
      new Vector3(0, 0, 0),
      new Vector3(1, 1, 1),
      enemyUnitRoot
    );

    assetsManager.load();

    // debug layer
    //this.scene.debugLayer.show();
  }

  private processPointer(pointerInfo: PointerInfo) {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        if (pointerInfo.pickInfo?.hit) {
          const pickedMesh = pointerInfo.pickInfo.pickedMesh;
          if (pickedMesh) {
            // Logic for handling interactions with pickedMesh
            console.log("Picked mesh: ", pickedMesh.name);
          }
        }
        break;
      // Add additional cases for other pointer events if needed
    }
  }

  private onControllerAdded(controller: WebXRInputSource) {
    // Logic for when a controller is added
    console.log("Controller added: ", controller.inputSource.handedness);

    // replace the default controller model
    var assetsManager = new AssetsManager(this.scene);
    if (controller.inputSource.handedness === "right") {
      // right controller
      var rightMeshTask = assetsManager.addMeshTask(
        "loadControllerMesh",
        "",
        "assets/models/",
        "grapplearm.glb"
      );
      rightMeshTask.onSuccess = (task) => {
        // attach model to the controller
        task.loadedMeshes.forEach((mesh) => {
          mesh.scaling = new Vector3(0.06, 0.06, 0.06);
          mesh.position = new Vector3(0, -0.05, 0);
          mesh.rotate(new Vector3(1, 0, -1), Math.PI);
          mesh.parent = controller.pointer;
        });
      };
    } else if (controller.inputSource.handedness === "left") {
      // left controller
      var leftMeshTask = assetsManager.addMeshTask(
        "loadControllerMesh",
        "",
        "assets/models/",
        "suction-cup.glb"
      );
      leftMeshTask.onSuccess = (task) => {
        // attach model to the controller
        task.loadedMeshes.forEach((mesh) => {
          mesh.scaling = new Vector3(0.005, 0.005, 0.005);
          mesh.position = new Vector3(0, -0.2, 0.1);
          mesh.rotate(new Vector3(0, 1, 0), Math.PI);
          mesh.parent = controller.pointer;
        });
      };

      // text to show remainingDeltaV
      // Create a dynamic texture with text
      const textureSize = 512;
      const dynamicTexture = new DynamicTexture("DynamicTexture", {width: textureSize, height: textureSize}, this.scene);
      dynamicTexture.drawText(this.remainingDeltaV.toString(), null, null, "bold 44px Arial", "#FFFFFF", "#00000000", true);

      // Create a plane to apply the texture
      const textPlane = MeshBuilder.CreatePlane("textPlane", {size: 0.2}, this.scene);
      const material = new StandardMaterial("textPlaneMaterial", this.scene);
      material.diffuseTexture = dynamicTexture;
      material.specularColor = new Color3(0, 0, 0); // Remove specular highlight
      textPlane.material = material;

      // Position and rotate the text plane to face upwards or towards a desired direction
      textPlane.position = new Vector3(0, 0.05, -0.1); // Adjust as needed
      textPlane.rotationQuaternion = Quaternion.FromEulerAngles(Math.PI / 2, 0, 0);

      // Attach the text plane to the controller
      textPlane.parent = controller.pointer;
    }
  
    controller.onMotionControllerInitObservable.add((motionController) => {
      const ids = motionController.getComponentIds();
      console.log("Component IDs: ", ids);

      const thumbstickComponent = motionController.getComponent('xr-standard-thumbstick');
      const triggerComponent = motionController.getComponent('xr-standard-trigger');
      const squeezeComponent = motionController.getComponent('xr-standard-squeeze');
      const aButtonComponent = motionController.getComponent('a-button');
      const bButtonComponent = motionController.getComponent('b-button');
      const xButtonComponent = motionController.getComponent('x-button');
      const yButtonComponent = motionController.getComponent('y-button');

      if(thumbstickComponent){
        thumbstickComponent.onAxisValueChangedObservable.add((axisData) => {
          if(axisData){
            this.thumbstickAxis = new Vector3(axisData.x, axisData.y, 0);
          }
        });
      }

      if(triggerComponent){
        triggerComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isTriggerPreesing = true;  
          }else{
            this.isTriggerPreesing = false;
          }
        });
      }

      if(squeezeComponent){
        squeezeComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isSqueezePreesing = true;  
          }else{
            this.isSqueezePreesing = false;
          }
        });
      }

      // b/a y/x button to move up/down
      if(bButtonComponent){
        bButtonComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isBButtonPreesing = true;  
          }else{
            this.isBButtonPreesing = false;
          }
        });
      }
      if(aButtonComponent){
        aButtonComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isAButtonPreesing = true;  
          }else{
            this.isAButtonPreesing = false;
          }
        });
      }
      if(yButtonComponent){
        yButtonComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isYButtonPreesing = true;  
          }else{
            this.isYButtonPreesing = false;
          }
        });
      }
      if(xButtonComponent){
        xButtonComponent.onButtonStateChangedObservable.add((component) => {
          if(component.pressed){
            this.isXButtonPreesing = true;  
          }else{
            this.isXButtonPreesing = false;
          }
        });
      }

    });

    assetsManager.load();
  }

  private onControllerRemoved(controller: WebXRInputSource) {
    // Logic for when a controller is removed
    console.log("Controller removed: ", controller.inputSource.handedness);
  }

  private addMeshTask(
    assetsManager: AssetsManager,
    name: string,
    folder: string,
    fileName: string,
    position: Vector3,
    rotation: Vector3,
    scaling: Vector3,
    parent: TransformNode
  ): void {
    const task = assetsManager.addMeshTask(
      name + " Task",
      "",
      folder,
      fileName
    );
    task.onSuccess = (task) =>
      this.setupModel(task, name, position, rotation, scaling, parent);
  }

  private setupModel(
    task: MeshAssetTask,
    name: string,
    position: Vector3,
    rotation: Vector3,
    scaling: Vector3,
    parent: TransformNode
  ): void {
    const model = task.loadedMeshes[0];
    model.name = name;
    model.position = position;
    model.rotation = rotation;
    model.scaling = scaling;
    model.parent = parent;
    // 6. collision detection
    model.checkCollisions = true;
  }
}

var game = new Game();
game.start();
