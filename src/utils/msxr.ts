import * as Colyseus from "colyseus.js";
import { Object3D, Vector3 } from "three";
import { prefabs } from "../prefabs/prefabs";
import { renderAsEntity } from "./jsx-entity";
import { addComponent, removeEntity } from "bitecs";
import { paths } from "../systems/userinput/paths";
import { AElement } from "aframe";
import { loadModel } from "../components/gltf-model-plus";
import { preload, waitForPreloads } from "./preload";
import { loadTexture } from "./load-texture";

export type JoinEvent = {
    displayName: string;
    device: string;
    token: string;
}

export type EntityRef = {
    localEid : number;
    remoteEid: number;
    name: string;
}

const loadedModels = new Map();
const loadedTextures = new Map();

export function getLoadedModel(id : string) {
    return loadedModels.get(id);
}

export function getLoadedTexture(id : string) {
    return loadedTextures.get(id);
}

export default class MetaScriptXR {

    private client: Colyseus.Client;
    private currentRoom: Colyseus.Room<any>;  
    private localEntities = new Map<number, EntityRef>();
    private localPlayers : any = {};
    private syncTimer: any;
    private entitySpawnTick : any;

    private currentPosition = new Vector3(0, 0, 0);
    private lastPosition = new Vector3(0, 0, 0);

    private lastHoverObject = -1;
    private lastClickTime : any = [];

    constructor() {
        this.client = new Colyseus.Client('wss://localhost:2567');
        this.syncPlayerCoordinates();
    }

    private getEntityRef(localEid: number): EntityRef | undefined {
        for (const [remoteEid, entityRef] of this.localEntities) {
            if (entityRef.localEid === localEid) {
                return { localEid: localEid, remoteEid: remoteEid, name: entityRef.name };
            }
        }
        return undefined;
    }

    join(event : JoinEvent) {
        this.client.joinOrCreate("state_handler", { 
            "token": event.token,
            "displayName": event.displayName,
            "hubId": APP.hub?.hub_id
        }).then((room : Colyseus.Room) => {

            // save reference to room so we can send messages to and from
            this.currentRoom = room;

            const that = this;            
            const scene = AFRAME.scenes[0];
            const lookAts = new Map();
            const queue: any[] = [];

            if(this.entitySpawnTick) {
                clearInterval(this.entitySpawnTick);
                this.entitySpawnTick = null;
            }

            // listen to patches coming from the server
            room.state.players.onAdd(function (player: any, sessionId: string) {
                that.localPlayers[sessionId] = player;
            });
            
            room.state.players.onRemove(function (player : any, sessionId: string) {
                delete that.localPlayers[sessionId];
            }); 
        
            // emit event to sound-effects-system to register a new sound
            room.onMessage('registerSound', (data) => {
                console.log("Registering sound", data);
                scene.emit("registerSound", { id: data.id, url: data.url });
            });

            // emit event to load a texture
            room.onMessage('registerTexture', (data) => {
                console.log("Registering texture", data);
                preload(loadTexture(data.src, data.version, data.contentType).then((src : any) => {

                    console.log("src", data.src)

                    loadedTextures.set(data.id, data.src);
                }));
            });
                    
            // emit event to sound-effects-system to register a new sound
            room.onMessage('registerModel', (data) => {
                console.log("Registering model", data);
                preload(loadModel(data.url, null, true, null).then(() => {
                    loadedModels.set(data.id, data.url);
                }));
            });

            // handling playing preloaded auto data
            room.onMessage('playSound', (data) => {
                const soundSystem = scene.systems["hubs-systems"].soundEffectsSystem;
                soundSystem.playSoundOneShot(data.soundId);
            });

            // send message
            room.onMessage("sendMessage", (data) => {
                APP.hubChannel?.sendMessage(data.message);
            });
        
            // entity creation message
            room.onMessage("createEntity", (entityCreateMessage) => {
                queue.push(entityCreateMessage);
            });
        
            // entity modification message
            room.onMessage("modifyEntity", (entityModifyMessage) => {
                console.log("[MSXR]: Modifying entity:" + JSON.stringify(entityModifyMessage));
                if(!that.localEntities.get(entityModifyMessage.id)) {
                    throw new Error("Entity with id not found!");
                }
                // modify entity based on id assigned at the time of creation
                const entityRef = that.localEntities.get(entityModifyMessage.id);
                const obj = APP.world.eid2obj.get(entityRef?.localEid as number) as Object3D;

                // visibility
                if (entityModifyMessage.visible) {
                    obj.visible = entityModifyMessage.visible;
                }

                // position
                if (entityModifyMessage.position) {
                    obj.position.set(entityModifyMessage.position.x, entityModifyMessage.position.y, entityModifyMessage.position.z);
                    obj.updateMatrix();
                }

                // scale
                if (entityModifyMessage.scale) {
                    obj.scale.set(entityModifyMessage.scale, entityModifyMessage.scale, entityModifyMessage.scale);
                    obj.updateMatrix();
                }

                // color
                if (entityModifyMessage.color) {
                    const newColor = entityModifyMessage.color;
                    if (obj instanceof THREE.Mesh) {
                      const material = obj.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
                      material.color.set(newColor);
                    }
                }

            });
    
            // entity deletion message
            room.onMessage("deleteEntity", (entityDeleteMessage) => {
                if(!that.localEntities.get(entityDeleteMessage.id)) {
                    throw new Error("Entity with id not found!");
                }
                console.log("[MSXR]: Deleting entity", entityDeleteMessage);
                // remove entity based on id assigned at the time of creation
                const entityRef = that.localEntities.get(entityDeleteMessage.id);
                removeEntity(APP.world, entityRef?.localEid as number);
                this.currentRoom.send("onEntityDestroyed", this.localEntities.get(entityDeleteMessage.id));
                that.localEntities.delete(entityDeleteMessage.id);
            });

            // entity look at message
            room.onMessage("lookAt", (entityLookAtMessage) => {
                if(!that.localEntities.get(entityLookAtMessage.id)) {
                    throw new Error("Entity with id not found!");
                }
                if(lookAts.get(entityLookAtMessage.id)) {
                    throw new Error("Entity is already looking towards avatar");
                }
                console.log("[MSXR]: Look at entity", entityLookAtMessage);
                const entityRef = that.localEntities.get(entityLookAtMessage.id);
                const obj = APP.world.eid2obj.get(entityRef?.localEid as number);
                const avatarPosition = new Vector3();
                const avatarPov = (document.querySelector("#avatar-pov-node")! as AElement).object3D;
                if(!lookAts.get(entityLookAtMessage.id)) {
                    // update object position at a rate of 60 FPS
                    const timer = setInterval(() => {
                        if(!this.localEntities.has(entityLookAtMessage.id)) {
                            const timer = lookAts.get(entityLookAtMessage.id);
                            if(timer) {
                                lookAts.delete(entityLookAtMessage.id);
                                clearInterval(timer);
                                return;
                            }
                        }
                        avatarPov.getWorldPosition(avatarPosition);
                        obj?.lookAt(avatarPosition);
                    }, 16);
                    lookAts.set(entityLookAtMessage.id, timer);
                }
            });

            // Ensures assets are present before attempting to spawn entities
            this.entitySpawnTick = setInterval(() => {
                waitForPreloads().then(() => {
                    if(queue.length > 0) {
                        const entityCreateMessage = queue.pop();
                        if(that.localEntities.get(entityCreateMessage.id)) {
                            throw new Error("Entity with id already exists!");
                        }
                        console.log("[MSXR]: Creating entity", entityCreateMessage);
                        const entity = prefabs.get("entity")!.template(entityCreateMessage);
                        const localEid = renderAsEntity(APP.world, entity);
                        // keep track of local and remote id
                        this.localEntities.set(entityCreateMessage.id, {
                            localEid: localEid,
                            remoteEid: entityCreateMessage.id,
                            name: entityCreateMessage.name
                        });
                        const rootObj = APP.world.eid2obj.get(localEid)!;
                        scene.object3D.add(rootObj);
                        // add all the child components recursively
                        if(entityCreateMessage.children) {
                            that.addChildEntity(entityCreateMessage.children, rootObj);
                        }
                        this.currentRoom.send("onEntityCreated", this.localEntities.get(entityCreateMessage.id));
                    }
                });
            }, 100);
    
        }).catch(e => {
            console.log("JOIN ERROR", e);
        });
    }

    private syncPlayerCoordinates() {
        const avatarPov = (document.querySelector("#avatar-pov-node")! as AElement).object3D;
        if(this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        this.syncTimer = setInterval(() => {
            if(this.currentRoom == null) {
                // need to be connected to server to sync position
                return;
            }
            avatarPov.getWorldPosition(this.currentPosition);
            if(this.lastPosition.equals(this.currentPosition)) {
              return;
            }
            this.currentRoom.send("updatePosition", { x: this.currentPosition.x, y: this.currentPosition.y, z: this.currentPosition.z });
            this.lastPosition.copy(this.currentPosition)
        }, 100);
    }

    processHoverEvents(isHoveringSomething : boolean, remoteHoverTarget : number) {
        if(this.currentRoom) {
            if(!isHoveringSomething) {
                if(this.lastHoverObject > 0) {
                    const entityRef = this.getEntityRef(this.lastHoverObject);
                    if(!entityRef) {
                        console.warn("[MSXR]: Could not find entity ref for " + this.lastHoverObject)
                    } else {
                        this.currentRoom.send("onEntityHoverExit", {
                            id: entityRef
                        });
                    }
                    this.lastHoverObject = -1;
                }
            } else {
                if(remoteHoverTarget != this.lastHoverObject) {
                    const entityRef = this.getEntityRef(remoteHoverTarget);
                    if(!entityRef) {
                        console.warn("[MSXR]: Could not find entity ref for " + remoteHoverTarget)
                    } else {
                        this.currentRoom.send("onEntityHoverEntered", {
                            id: entityRef
                        });
                    }
                    this.lastHoverObject = remoteHoverTarget;
                }
            }
        }
    }

    processClickEvents() {
        const userinput = AFRAME.scenes[0].systems.userinput;
        let rightButtonClicked = userinput.get(paths.device.mouse.buttonRight);
        let leftButtonClicked = userinput.get(paths.device.mouse.buttonLeft);
        if(this.lastHoverObject != -1) { 
            // handle sending entity click events to the server
            if(leftButtonClicked || rightButtonClicked) {
                if(this.currentRoom) {
                    const timeSinceLastClick = Date.now() - this.lastClickTime[this.lastHoverObject];
                    if(timeSinceLastClick <= 500) {
                        // prevent spam clicking events
                        return;
                    }
                    const entityRef = this.getEntityRef(this.lastHoverObject);
                    if(!entityRef) {
                        console.warn("[MSXR]: Could not find entity ref for " + this.lastHoverObject)
                    } else {
                        this.currentRoom.send("onEntityClicked", {
                            id: entityRef,
                            isLeft: leftButtonClicked,
                            isRight: rightButtonClicked
                        });
                    }
                    this.lastClickTime[this.lastHoverObject] = Date.now(); // this timestamp
                }
                this.lastHoverObject = -1;
            }
        }
    }

    private addChildEntity(children : any, parentObj : any) {
        children.forEach((child : any) => {
            const childEid = renderAsEntity(APP.world, prefabs.get("entity")!.template(child));
            const childObj = APP.world.eid2obj.get(childEid);
            parentObj.add(childObj);
            const entityRef = {
                localEid: childEid,
                remoteEid: child.id,
                name: child.name
            };
            // keep track of local and remote id
            this.localEntities.set(child.id, entityRef);
            
            // recursively add child's children
            if (child.children && child.children.length > 0) {
                this.addChildEntity(child.children, childObj);
            }
        });
    }    
    
}