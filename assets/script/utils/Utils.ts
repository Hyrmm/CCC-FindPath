/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:34 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-04-30 14:43:18
 */

export function getMidpoint(point1: cc.Vec2, point2: cc.Vec2): cc.Vec2 {
    const xMid = (point1.x + point2.x) / 2;
    const yMid = (point1.y + point2.y) / 2;
    return new cc.Vec2(xMid, yMid);
}

export function getCircumcenter(vertexs: Array<cc.Vec2>): cc.Vec2 {
    // 计算中垂线斜率
    const A = vertexs[0];
    const B = vertexs[1];
    const C = vertexs[2];
    // 计算中垂线斜率
    const kAB = -((B.x - A.x) / (B.y - A.y));
    const kBC = -((C.x - B.x) / (C.y - B.y));
    const kCA = -((A.x - C.x) / (A.y - C.y));

    // 计算中垂线的中点坐标
    const MAB: cc.Vec2 = new cc.Vec2((A.x + B.x) / 2, (A.y + B.y) / 2);
    const MBC: cc.Vec2 = new cc.Vec2((B.x + C.x) / 2, (B.y + C.y) / 2);
    const MCA: cc.Vec2 = new cc.Vec2((C.x + A.x) / 2, (C.y + A.y) / 2);

    // 计算中垂线方程
    const xIntersectAB = (kAB * MAB.x - MAB.y + C.y - kCA * C.x) / (kAB - kCA);
    const yIntersectAB = kAB * (xIntersectAB - MAB.x) + MAB.y;
    const xIntersectBC = (kBC * MBC.x - MBC.y + A.y - kCA * A.x) / (kBC - kCA);
    const yIntersectBC = kBC * (xIntersectBC - MBC.x) + MBC.y;

    // 外心坐标
    const xCenter = (yIntersectAB * (MBC.x - MAB.x) + MAB.y * (MBC.x - MAB.x) - yIntersectBC * (MBC.x - MAB.x) + MBC.y * (MBC.x - MAB.x)) /
        (2 * (MBC.y - MAB.y))
    const yCenter = (xIntersectAB * (MBC.y - MAB.y) + MAB.x * (MBC.y - MAB.y) - xIntersectBC * (MBC.y - MAB.y) + MBC.x * (MBC.y - MAB.y)) /
        (2 * (MBC.x - MAB.x))

    return new cc.Vec2(xCenter, yCenter)
}

export function getCommonVertexs(vertexs1: Array<cc.Vec2>, vertexs2: Array<cc.Vec2>): Array<cc.Vec2> {

    const result: Array<cc.Vec2> = []

    for (const vertex of vertexs1) {
        if (vertexs2.includes(vertex) && !result.includes(vertex)) {
            result.push(vertex);
        }
    }
    return result
}
/**
 * 
 * @param point1 
 * @param point2 
 * @param type 0:根据x值求y值 1:根据y值求x值
 * @returns 
 */
export function getLineFunc(point1: cc.Vec2, point2: cc.Vec2, type: number): (p: number) => number {

    if (point1.x === point2.x) {

        if (type == 0) {
            throw new Error("两点所确定直线垂直于x轴，不能根据x值得到y值");
        }
        else if (type == 1) {
            return (y: number) => point1.x
        }

    }
    else if (point1.y === point2.y) {
        if (type == 0) {
            return (x: number) => point1.y
        }
        else if (type == 1) {
            throw new Error("两点所确定直线垂直于y轴，不能根据y值得到x值");
        }
    }

    const k = (point2.y - point1.y) / (point2.x - point1.x)
    const b = point1.y - k * point1.x

    if (type == 0) {
        return (x: number) => k * x + b
    }
    else if (type == 1) {
        return (y: number) => (y - b) / k
    }

}

export function flatVertexs2Vec2(vertexs: Array<number>) {
    const result: Array<cc.Vec2> = []
    for (let i = 0; i < vertexs.length; i += 2) {
        result.push(new cc.Vec2(vertexs[i], vertexs[i + 1]))
    }
    return result
}