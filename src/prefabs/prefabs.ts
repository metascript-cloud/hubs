// important

import { MediaLoaderParams } from "../inflators/media-loader";
import { EntityCreateParams } from "../entity";
import { CameraPrefab, CubeMediaFramePrefab } from "../prefabs/camera-tool";
import { MediaPrefab } from "../prefabs/media";
import { EntityDef } from "../utils/jsx-entity";
import { EntityPrefab } from "./entity";
import { DuckPrefab } from "./duck";

type CameraPrefabT = () => EntityDef;
type EntityPrefabT = (params : EntityCreateParams) => EntityDef;
type CubeMediaPrefabT = () => EntityDef;
type MediaPrefabT = (params: MediaLoaderParams) => EntityDef;

export type PrefabDefinition = {
  permission?: "spawn_camera";
  template: CameraPrefabT | CubeMediaPrefabT | MediaPrefabT | EntityPrefabT;
};

export type PrefabName = "camera" | "cube" | "media" | "entity";

export const prefabs = new Map<PrefabName, PrefabDefinition>();
prefabs.set("camera", { permission: "spawn_camera", template: CameraPrefab });
prefabs.set("cube", { template: CubeMediaFramePrefab });
prefabs.set("media", { template: MediaPrefab });
prefabs.set("entity", { template: EntityPrefab });