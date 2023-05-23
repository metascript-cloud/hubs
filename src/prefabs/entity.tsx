/** @jsx createElementEntity */
import { createElementEntity, EntityDef } from "../utils/jsx-entity";
import { COLLISION_LAYERS } from "../constants";
import { Fit, PhysicsShapeParams, Shape } from "../inflators/physics-shape";
import { EntityCreateParams as Entity } from "../entity";

export function EntityPrefab(params: Entity): EntityDef {
  let mesh = null;
  let shape = null;
  const material = new THREE.MeshBasicMaterial({
    color: params.color ? params.color: "#ffffff",
    opacity: params.opacity ? params.opacity : 1,
    transparent: true,
    wireframe: false
  });
  switch(params.type) {
    case "box":
      mesh = new THREE.Mesh(new THREE.BoxBufferGeometry(params.shape.width, params.shape.height, params.shape.depth), material);
      shape = { fit: Fit.MANUAL, type: Shape.BOX } as PhysicsShapeParams;
      break;
    default:
      throw new Error("Invalid entity type")
  } 

  // render entity
  return (
    <entity
      name={params.name}
      networked
      networkedTransform
      cursorRaycastable
      remoteHoverTarget
      handCollisionTarget
      offersHandConstraint
      floatyObject
      rigidbody={{
        collisionGroup: COLLISION_LAYERS.INTERACTABLES,
        collisionMask:
          COLLISION_LAYERS.HANDS |
          COLLISION_LAYERS.ENVIRONMENT |
          COLLISION_LAYERS.INTERACTABLES |
          COLLISION_LAYERS.AVATAR
      }}
      physicsShape={shape}
      object3D={mesh}
      position={[params.position.x, params.position.y, params.position.z]} 
      rotation={[params.rotation.x, params.rotation.y, params.rotation.z]}
      scale={[params.scale.x, params.scale.y, params.scale.z]}
    >
    </entity>
  );
}
