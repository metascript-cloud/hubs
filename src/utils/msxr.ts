import * as Colyseus from "colyseus.js";
import { Vector3 } from "three";
import { prefabs } from "../prefabs/prefabs";
import { renderAsEntity } from "./jsx-entity";
import { addComponent, removeEntity } from "bitecs";
import { paths } from "../systems/userinput/paths";
import { AElement } from "aframe";

export default class MetaScriptXR {

    private client: Colyseus.Client;
    private currentRoom: Colyseus.Room<any>;  
    private entities : any = {};
    private localPlayers : any = {};
    private syncTimer: any;

    private currentPosition = new Vector3(0, 0, 0);
    private lastPosition = new Vector3(0, 0, 0);

    private lastHoverObject = -1;
    private lastClickTime : any = [];

    constructor() {
        this.client = new Colyseus.Client('ws://localhost:2567');
        this.syncPlayerCoordinates();
    }

    join(token : string) {
        this.client.joinOrCreate("state_handler", { 
            "token": token
        }).then((room : Colyseus.Room) => {

            // save reference to room so we can send messages to and from
            this.currentRoom = room;

            const that = this;            
            const scene = AFRAME.scenes[0];

            // listen to patches coming from the server
            room.state.players.onAdd(function (player: any, sessionId: string) {
                that.localPlayers[sessionId] = player;
            });
            
            room.state.players.onRemove(function (player : any, sessionId: string) {
                delete that.localPlayers[sessionId];
            });
        
            // emit event to sound-effects-system to register a new sound
            room.onMessage('registerSound', (data) => {
                scene.emit("registerSound", { id: data.id, url: data.url });
            });
        
            // handling playing preloaded auto data
            room.onMessage('playSound', (data) => {
                const soundSystem = scene.systems["hubs-systems"].soundEffectsSystem;
                soundSystem.playSoundOneShot(data.soundId);
            });
        
            // entity creation message
            room.onMessage("createEntity", (entityCreateMessage) => {
                if (that.entities[entityCreateMessage.id]) {
                    throw new Error("Entity with id already exists!");
                }
                console.log("[MSXR]: Creating entity: " + JSON.stringify(entityCreateMessage));
                const eid = renderAsEntity(APP.world, prefabs.get("entity")!.template(entityCreateMessage));
                that.entities[entityCreateMessage.id] = eid;
                const rootObj = APP.world.eid2obj.get(eid)!;
                scene.object3D.add(rootObj);

                // add all the child components recursively
                if(entityCreateMessage.children) {
                    that.addChildEntity(entityCreateMessage.children, rootObj);
                }
            });
        
            // entity modification message
            room.onMessage("modifyEntity", (entityModifyMessage) => {
                if(!that.entities[entityModifyMessage.id]) {
                    throw new Error("Entity with id not found!");
                }
                console.log("[MSXR]: Modifying entity:" + JSON.stringify(entityModifyMessage));
                // remove entiy based on id assigned at the time of creation
                if(that.entities[entityModifyMessage.id]) {
                    const obj = APP.world.eid2obj.get(that.entities[entityModifyMessage.id]);
                    // modify or sync state?
                }
            });
    
            // entity deletion message
            room.onMessage("deleteEntity", (entityDeleteMessage) => {
                if(!that.entities[entityDeleteMessage.id]) {
                    throw new Error("Entity with id not found!");
                }
                console.log("[MSXR]: Deleting entity:" + JSON.stringify(entityDeleteMessage));
                // remove entiy based on id assigned at the time of creation
                if(that.entities[entityDeleteMessage.id]) {
                    removeEntity(APP.world, that.entities[entityDeleteMessage.id]);
                    delete that.entities[entityDeleteMessage.id];
                }
            });
    
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
            avatarPov.getWorldPosition(this.currentPosition);
            if(this.lastPosition.equals(this.currentPosition)) {
              return;
            }
            this.currentRoom.send("updatePosition", { x: this.currentPosition.x, y: this.currentPosition.y, z: this.currentPosition.z });
            this.lastPosition.copy(this.currentPosition)
        }, 500);
    }

    processHoverEvents(isHoveringSomething : boolean, remoteHoverTarget : number) {
        if(this.currentRoom) {
            if(!isHoveringSomething) {
                if(this.lastHoverObject > 0) {
                    this.currentRoom.send("onEntityHoverExit", { id: this.lastHoverObject })
                    this.lastHoverObject = -1;
                }
            } else {
                if(remoteHoverTarget != this.lastHoverObject) {
                    this.currentRoom.send("onEntityHoverEntered", { id: remoteHoverTarget })
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
                    this.currentRoom.send("onEntityClicked", {
                        id: this.lastHoverObject,
                        isLeft: leftButtonClicked,
                        isRight: rightButtonClicked
                    });
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
        
            // recursively add child's children
            if (child.children && child.children.length > 0) {
                this.addChildEntity(child.children, childObj);
            }
        });
    }    
    
}