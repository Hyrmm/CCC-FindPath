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
    }

    private updateEneityInterpPos(dt: number): void {
        // 插值，影子追踪算法，相对平滑的移动
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
                if (Math.abs(offsetPos.x) <= 1 && Math.abs(offsetPos.y) <= 1) entity.curShadowPos = null
            } else {
                entity.curShadowPos = null
            }

        }
    }

    public addEntity(entity: Entity): void {
        if (this.entities.has(entity.name)) console.warn(`Entity ${entity.name} 已经存在`)
        this.entities.set(entity.name, entity)
    }

    public addShadowPos(entityName: string, pos: Array<cc.Vec2>): void {
        if (!this.entities.has(entityName)) return
        this.entities.get(entityName).shadowPos = pos
        this.entities.get(entityName).curShadowPos = null
    }
}


export type Entity = {
    shadowPos?: Array<cc.Vec2>
    curShadowPos?: cc.Vec2 | null
} & cc.Node
