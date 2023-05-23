import { Vector3 } from "three";

type Shape = {

  width?: number;
  height?: number;
  depth?: number;

} 

export type EntityCreateParams = {
  id?: string;
  name: string;
  type: string;
  color?: string;
  opacity?: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  shape: Shape;
};