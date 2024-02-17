/** @jsx createElementEntity */
import { createElementEntity, EntityDef } from "../utils/jsx-entity";
import { EntityCreateParams as Entity } from "../entity";
import { Layers } from "../camera-layers";
import { cloneModelFromCache } from "../components/gltf-model-plus";
import { getLoadedModel, getLoadedTexture, getLoadedVideo } from "../utils/msxr";
import { ProjectionMode } from "../utils/projection-mode";
import { TextureCache } from "../utils/texture-cache";
import { AlphaMode } from "../utils/create-image-mesh";
import { loadTextureFromCache } from "../utils/load-texture";

export function EntityPrefab(data: Entity): EntityDef {
  
  let mesh = null; 
  let entity = null;
  let modelUrl = null;
  let textureUrl = null;

  const material = new THREE.MeshBasicMaterial({
    color: data.color ? data.color: "#ffffff",
    opacity: data.opacity ? data.opacity : 1,
    transparent: data.opacity != 1,
    wireframe: false
  }); 

  switch(data.type) {
    case "box":
      mesh = new THREE.Mesh(THREE.BoxBufferGeometry.fromJSON(data.shape), material);
      break;
    case "plane":
      mesh = new THREE.Mesh(THREE.PlaneBufferGeometry.fromJSON(data.shape), material);
      break;
    case "sphere":
      mesh = new THREE.Mesh(THREE.SphereBufferGeometry.fromJSON(data.shape), material);
      break;
    case "cylinder":
      mesh = new THREE.Mesh(THREE.CylinderBufferGeometry.fromJSON(data.shape), material);
      break;
    case "torus":
      mesh = new THREE.Mesh(THREE.TorusBufferGeometry.fromJSON(data.shape), material);
      break;
    case "circle":
      mesh = new THREE.Mesh(THREE.CircleBufferGeometry.fromJSON(data.shape), material);
      break;
    case "ring":
      mesh = new THREE.Mesh(THREE.RingBufferGeometry.fromJSON(data.shape), material);
      break;
    case "text":
      break;
    case "image":
      textureUrl = getLoadedTexture(data.textureId);
      if(!textureUrl) {
        throw new Error("Model not ready: " + data.textureId)
      }
      break;
    case "model":
      modelUrl = getLoadedModel(data.modelId);
      if(!modelUrl) {
        throw new Error("Model not ready: " + data.modelId)
      }
      break;
    default:
      throw new Error("Unhandled primitive type: " + data.type)
  } 

  switch(data.type) {
    case "text":
      // load text
      entity = <entity
        layers={1 << Layers.CAMERA_LAYER_UI}
        text={{ value: data.text!.value, color: data.text?.color, textAlign: "center", anchorX: "center", anchorY: "middle" }}
        position={[data.position.x, data.position.y, data.position.z]} 
        rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
        name={`${data.name}`}
      />
      break;
    case "model":
      // load gltf models
      entity = <entity
        model={{ model: cloneModelFromCache(modelUrl).scene }}
        position={[data.position.x, data.position.y, data.position.z]} 
        rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
        scale={[data.scale.x, data.scale.y, data.scale.z]}
        name={`${data.name}`}
      />      
      break

    case "image":
      entity = <entity
        image={{
          texture: loadTextureFromCache(textureUrl, 1).texture,
          ratio: 1400 / 1200,
          projection: ProjectionMode.FLAT,
          alphaMode: AlphaMode.MASK,
          cacheKey: TextureCache.key(data.textureId, 1)
        }}
        position={[data.position.x, data.position.y, data.position.z]} 
        rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
        scale={[data.scale.x, data.scale.y, data.scale.z]}
        name={`${data.name}`}
      />      
      break;

    default:
      // load primitives
      entity = <entity
        name={`${data.name}`}    
        object3D={mesh}
        position={[data.position.x, data.position.y, data.position.z]} 
        rotation={[data.rotation.x, data.rotation.y, data.rotation.z]}
        scale={[data.scale.x, data.scale.y, data.scale.z]}
        cursorRaycastable
        remoteHoverTarget
      />;
      break;
  }

  return entity;
}
