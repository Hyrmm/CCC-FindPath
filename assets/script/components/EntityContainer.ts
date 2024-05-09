/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:54:52 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-03 02:06:02
 */

const { ccclass, property } = cc._decorator;




@ccclass
export default class EntityContainer extends cc.Component {

    @property(cc.Node)
    entity_start: cc.Node = null

    private entities: Map<string, Entity> = new Map<string, Entity>()

    protected start(): void {
        this.addEntity(this.entity_start)
    }

    protected update(dt: number): void {
        this.updateEneityInterpPos(dt)
        this.updateEneityCommonPos(dt)
    }

    public addEntity(entity: Entity): void {
        if (this.entities.has(entity.name)) console.warn(`Entity ${entity.name} 已经存在`)
        this.entities.set(entity.name, entity)
    }

    public getEntity(entityName: string) {
        return this.entities.get(entityName)
    }

    public addShadowPos(entityName: string, pos: Array<cc.Vec2>): void {
        if (!this.entities.has(entityName)) return
        this.entities.get(entityName).shadowPos = pos
        this.entities.get(entityName).curShadowPos = null
    }

    public addCommonPos(entityName: string, pos: Array<cc.Vec2>): void {
        if (!this.entities.has(entityName)) return
        this.entities.get(entityName).commonPos = pos
        this.entities.get(entityName).curCommonPos = null
    }

    /**
     * 常规移动算法，v=s*t
     * @param dt 
     * @returns 
     */
    private updateEneityCommonPos(dt: number): void {
        const speed = 200
        for (const entity of this.entities.values()) {
            if ((!entity.commonPos || !entity.commonPos.length) && !entity.curCommonPos) return entity.state = null
            if (!entity.curCommonPos) entity.curCommonPos = entity.commonPos.shift()

            entity.state = EntityState.MOVING
            
            const distanceVec = entity.curCommonPos.sub(cc.v2(entity.position.x, entity.position.y))
            const distance = distanceVec.mag()

            // 如果距离小于每帧的移动距离，则说明已经到达目标位置
            if (distance <= speed * dt) {
                entity.setPosition(entity.curCommonPos.x, entity.curCommonPos.y)
                entity.curCommonPos = null
            } else {
                const moveDistance = distanceVec.normalize().mul(speed * dt)
                entity.position = entity.position.add(cc.v3(moveDistance.x, moveDistance.y, 0))
            }


        }
    }

    /**
     * 影子追踪算法，插值平滑移动
     * @param dt 
     * @returns 
     */
    private updateEneityInterpPos(dt: number): void {
        const delta = Math.min((dt * 1000) / 300, 1)
        for (const entity of this.entities.values()) {
            if ((!entity.shadowPos || !entity.shadowPos.length) && !entity.curShadowPos) return

            if (!entity.curShadowPos) entity.curShadowPos = entity.shadowPos.shift()

            const curPos = entity.position
            const curShadowPos = entity.curShadowPos
            const offsetPos = new cc.Vec2(curShadowPos.x - curPos.x, curShadowPos.y - curPos.y)

            if (!offsetPos.equals(cc.Vec2.ZERO)) {
                // 极限情况，真实位置永远趋近于目标影子位置，当相离位置小于1像素时直接修正到目标影子位置
                let interpolationX = Math.abs(offsetPos.x) <= 1 ? offsetPos.x : delta * offsetPos.x
                let interpolationY = Math.abs(offsetPos.y) <= 1 ? offsetPos.y : delta * offsetPos.y
                entity.position = entity.position.add(new cc.Vec3(interpolationX, interpolationY, 0))
                if (Math.abs(offsetPos.x) <= 0 && Math.abs(offsetPos.y) <= 0) entity.curShadowPos = null
            } else {
                entity.curShadowPos = null
            }

        }
    }

}

// export class Entity extends cc.Node {

//     private commonPos?: Array<cc.Vec2>
//     private curCommonPos?: cc.Vec2 | null
//     private shadowPos?: Array<cc.Vec2>
//     private curShadowPos?: cc.Vec2 | null

//     state: EntityState = EntityState.IDLE

//     constructor(name: string) {
//         super(name)
//     }
// }


export type Entity = {
    state?: EntityState | undefined
    commonPos?: Array<cc.Vec2> | undefined
    curCommonPos?: cc.Vec2 | undefined
    shadowPos?: Array<cc.Vec2> | undefined
    curShadowPos?: cc.Vec2 | undefined
} & cc.Node

export enum EntityState {
    IDLE,
    MOVING,
}