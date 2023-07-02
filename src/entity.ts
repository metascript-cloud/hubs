import { Vector3 } from "three";
import { EntityID } from "./utils/networking-types";

type Shape = {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
  radiusTop?: number,
  radiusBottom?: number,
  openEnded?: boolean,
  thetaStart?: number,
  thetaLength?: number,
  tube: number;
  radialSegments: number;
  tubularSegments: number;
  arc: number;
  segments: number;
} 

type Text = {
  value: string;
  color: string;
  textAlign: string;
  anchorX : string;
  anchorY: string;
}

export type EntityCreateParams = {
  id?: string;
  name: string;
  type: string;
  text?: Text;
  textureId: string;
  modelId: string,
  color?: string;
  parent?: EntityID;
  opacity?: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  shape: Shape;
  grabable: boolean;
  children: EntityCreateParams[]
};