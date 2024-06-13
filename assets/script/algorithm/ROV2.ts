/*
 * @Author: hyrm 
 * @Date: 2024-05-21 09:44:10 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-06-13 14:35:10
 */

import { KdTree, Point } from '../dataStructure/KdTree';

export class Line {

}
// // 最大速率
// public maxSpeed: number

// // KDTree查找的最大相邻Agent数量
// public maxNeighbors: number

// // KDTree查找相邻Agent时候的最大检测距离
// public neighborDist: number

// // 提前避障的时间（可以大于帧间隔deltaTime，表示要提前避障）
// public timeHorizon: number

export class Agent {

    public id: number
    public radius: number
    public weight: number

    public pos: cc.Vec2
    public targetPos: cc.Vec2

    public velocity: cc.Vec2
    public prefVelocity: cc.Vec2

    public point: Point

    constructor(pos: cc.Vec2) {
        this.id = Simulator.agents.push(this)

        this.pos = pos

        this.radius = 5
        this.weight = 0.5

        this.velocity = cc.v2(0, 0)
        this.prefVelocity = cc.v2(0, 0)

        this.point = [pos.x, pos.y]
    }

    public calcNewVelocity() {

        const neighbors = Simulator.agentsTree.searchNeiborRadius([this.pos.x, this.pos.y], this.radius)
        for (const neighbor of neighbors) {
            console.log(neighbor)
        }
    }
}

export class Simulator {

    static agents: Array<Agent> = []
    static agentsTree: KdTree<Agent> = null

    static execute(dt: number): void {

        // 重新构建KDTree
        this.agentsTree = KdTree.build(this.agents)

        // 计算每个Agent的期望速度
        this.agents.forEach(agent => agent.calcNewVelocity())


    }

    static addAgent(pos: cc.Vec2): Agent {
        return new Agent(pos)
    }

    static getAgent(id: number): Agent {
        return this.agents[id]
    }

}