import { AStarGridMesh, Block, BlockType } from "../algorithm/AStarGridMesh";

const { ccclass, property } = cc._decorator;


@ccclass
export default class GraphicsContainer extends cc.Component {

    @property([cc.Graphics])
    graphics: cc.Graphics[] = []

    protected start(): void {

    }
    public setScale(scale: number) {
        this.node.scale = scale
    }

    public drawMapMesh() {
        this.clear(GraphicsType.MESH)

        for (const block of AStarGridMesh.getInstance().allBlocks) {
            const pos = AStarGridMesh.getInstance().getPosByBlock(block)

            switch (block.type) {

                case BlockType.BLOCK:
                    this.drawRect(GraphicsType.MESH, cc.rect(pos.x, pos.y, 32, 32), cc.color(0, 255, 0, 80))
                    break
                case BlockType.WALL:
                    this.drawRect(GraphicsType.MESH, cc.rect(pos.x, pos.y, 32, 32), cc.color(255, 0, 0, 80), true)
                    break
            }
        }
    }

    public drawRect(type: GraphicsType, rect: cc.Rect, color: cc.Color = cc.Color.GREEN, fill: boolean = false) {
        const ctx = this.graphics[type]
        if (fill) {
            ctx.fillColor = color
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        } else {
            ctx.rect(rect.x, rect.y, rect.width, rect.height)
            ctx.strokeColor = color
            ctx.stroke()
        }

    }

    public drawLine(type: GraphicsType, points: Array<cc.Vec2>, color: cc.Color = cc.Color.BLACK) {
        const ctx = this.graphics[type]
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.strokeColor = color
        ctx.stroke()
    }

    public drawFov(type: GraphicsType, rect: cc.Rect) {
        const ctx = this.graphics[type]
        // ctx.circle(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.sqrt(rect.width ** 2 + rect.height ** 2) / 2)
        ctx.roundRect(rect.x, rect.y, 46, 46, 60)
        ctx.fillColor = cc.color(0, 0, 0, 255)
        ctx.fill()

    }

    public clear(type: GraphicsType) {
        const ctx = this.graphics[type]
        ctx.clear()
    }
}


export enum GraphicsType {
    MESH = 0,
    PATH = 1,
    WARFOV = 2
}
