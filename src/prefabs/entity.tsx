/** @jsx createElementEntity */
import { createElementEntity, EntityDef } from "../utils/jsx-entity";
import { EntityCreateParams as Entity } from "../entity";
import { Layers } from "../camera-layers";

export function EntityPrefab(e: Entity): EntityDef {
  let mesh = null; 
  let entity = null;
  const material = new THREE.MeshBasicMaterial({
    color: e.color ? e.color: "#ffffff",
    opacity: e.opacity ? e.opacity : 1,
    transparent: e.opacity != 1,
    wireframe: false
  }); 
  switch(e.type) {
    case "box":
      mesh = new THREE.Mesh(THREE.BoxBufferGeometry.fromJSON(e.shape), material);
      break;
    case "plane":
      mesh = new THREE.Mesh(THREE.PlaneBufferGeometry.fromJSON(e.shape), material);
      break;
    case "sphere":
      mesh = new THREE.Mesh(THREE.SphereBufferGeometry.fromJSON(e.shape), material);
      break;
    case "cylinder":
      mesh = new THREE.Mesh(THREE.CylinderBufferGeometry.fromJSON(e.shape), material);
      break;
    case "torus":
      mesh = new THREE.Mesh(THREE.TorusBufferGeometry.fromJSON(e.shape), material);
      break;
    case "circle":
      mesh = new THREE.Mesh(THREE.CircleBufferGeometry.fromJSON(e.shape), material);
      break;
    case "ring":
      mesh = new THREE.Mesh(THREE.RingBufferGeometry.fromJSON(e.shape), material);
      break;
    case "text":
      // text doesn't have a mesh per say but its still a valid entity
      break;
    default:
      throw new Error("Unhandled primitive type: " + e.type)
  } 

  switch(e.type) {
    case "text":
      entity = <entity
        layers={1 << Layers.CAMERA_LAYER_UI}
        text={{ value: e.text!.value, color: e.text?.color, textAlign: "center", anchorX: "center", anchorY: "middle" }}
        position={[e.position.x, e.position.y, e.position.z]} 
        rotation={[e.rotation.x, e.rotation.y, e.rotation.z]}
        name={`${name} Label`}
      />
      break;
    default:
      entity = <entity
        name={e.name}      
        object3D={mesh}
        position={[e.position.x, e.position.y, e.position.z]} 
        rotation={[e.rotation.x, e.rotation.y, e.rotation.z]}
        scale={[e.scale.x, e.scale.y, e.scale.z]}
        cursorRaycastable
        remoteHoverTarget
      />;
      break;
  }

  return entity;
}
