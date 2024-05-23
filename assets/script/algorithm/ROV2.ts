/*
 * @Author: hyrm 
 * @Date: 2024-05-21 09:44:10 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-22 16:24:08
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

    // 圆的半径
    public radius: number

    // 避障权重
    public weight: number

    // 当前位置
    public position: cc.Vec2

    // 目标位置
    public targetPos: cc.Vec2

    // 当前速度
    public velocity: cc.Vec2

    // 期望速度
    public prefVelocity: cc.Vec2

    public point: Point

}

export class Simulator {

    private static instance: Simulator

    public agents: Array<Agent> = []
    public agentsTree: KdTree<Agent> = null

    public static getInstance(): Simulator {
        if (!Simulator.instance) Simulator.instance = new Simulator()
        return Simulator.instance
    }

    public execute(dt: number): void {

        const points = new Array<Point>(this.agents.length)
        for (const agent of this.agents) points.push([agent.position.x, agent.position.y])

        this.agentsTree = KdTree.build(this.agents)

        // 计算每个Agent的期望速度
        for (const agent of this.agents) {
            const newVelocity = this.calcNewVelocity(agent)

        }


    }

    public addAgent(pos: cc.Vec2): Agent {
        const agent = new Agent()

        agent.id = this.agents.push(agent)
        agent.position = pos
        agent.velocity = cc.v2(0, 0)
        agent.prefVelocity = cc.v2(0, 0)
        agent.radius = 10
        agent.weight = 0.5
        agent.point = [pos.x, pos.y]

        return agent
    }

    public calcNewVelocity(agent: Agent): void {

        const neighbors = this.agentsTree.searchKNearest(agent.point)
        for (const neighbor of neighbors) {
                        
        }
    }


}