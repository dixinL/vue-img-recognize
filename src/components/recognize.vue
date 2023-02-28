<template>
  <div class="hello">
    <img ref="img" id="img" :src="img" hidden alt="" />
    <canvas
      ref="recognizeCanvas"
      id="recognizeCanvas"
      width="50"
      height="50"
    ></canvas>
  </div>
</template>

<script>
export default {
  data () {
    return {
      img: require('@/assets/imgs/背景图.jpg'),
      cWidth: 670, // 图片宽度
      qrCodeSize: 110, // 二维码预设大小
      precision: 0.9, // 容差值，0~1，宽松~严格
      colorPrecision: 0.96, // 颜色的容差值，0~1，宽松~严格（1：RGB(255, 255, 255))
      padding: 8, // 二维码边框宽度
      imgMsg: {},
      ctx: {},
      imgData: [],
      tempImgData: [[]],
      extractRowMap: new Map(),
      extractColMap: new Map()
    }
  },
  methods: {
    drawCanvas (img_obj) {
      // 绘制canvas
      let canvas_obj = this.$refs.recognizeCanvas
      canvas_obj.width = this.cWidth
      canvas_obj.height =
        (this.cWidth * img_obj.naturalHeight) / img_obj.naturalWidth
      this.ctx = canvas_obj.getContext('2d')
      this.ctx.drawImage(
        img_obj,
        0,
        0,
        img_obj.naturalWidth,
        img_obj.naturalHeight,
        0,
        0,
        this.cWidth,
        canvas_obj.height
      )
      // 将图片数据转换为点位数组，该数组每四位通过RGBA格式表示一个点位
      this.imgMsg = this.ctx.getImageData(
        0,
        0,
        canvas_obj.width,
        canvas_obj.height
      )
      this.imgData = this.imgMsg.data
    },
    getCanvasData () {
      // 整合canvas数据
      // 将点位数据整理收集得到三组数据
      // 1、tempImgData：利用0/1表示符合条件的颜色，并利用原始一维数组构建出二维矩阵
      // 2、extractRowMap：表示每一行中符合条件的颜色数量
      // 3、extractColMap：表示每一列中符合条件的颜色数量
      let pxRow = 0
      let pxCol = 0
      for (let i = 0; i < this.imgData.length; i += 4) {
        if (
          this.imgData[i] >= 255 * this.colorPrecision &&
          this.imgData[i + 1] >= 255 * this.colorPrecision &&
          this.imgData[i + 2] >= 255 * this.colorPrecision
        ) {
          this.tempImgData[pxRow][pxCol] = 1
          this.extractRowMap.set(
            pxRow,
            (this.extractRowMap.get(pxRow) || 0) + 1
          )
          this.extractColMap.set(
            pxCol,
            (this.extractColMap.get(pxCol) || 0) + 1
          )
          pxCol++
        } else {
          this.tempImgData[pxRow][pxCol] = 0
          pxCol++
        }
        if (pxCol === this.cWidth) {
          pxRow++
          this.tempImgData[pxRow] = []
          pxCol = 0
        }
      }
    },
    computeBorder (extractMap, maxLimit) {
      let extractMapTwice = new Map()
      // 通过extractMapTwice过滤出满足条件尺寸的行数或列数
      // extractMapTwice：key: 行或列数据中满足条件的点位数量
      //                  value： 满足key的行或列数量
      extractMap.forEach((val, key) => {
        if (
          val >= (this.qrCodeSize + 2 * this.padding) * this.precision &&
          val <= (this.qrCodeSize + 2 * this.padding) * (2 - this.precision)
        ) {
          extractMapTwice.set(val, (extractMapTwice.get(val) || 0) + 1)
        }
      })
      let maxVote = 0
      let maxVoteVal = 0
      let minGroup = Number.MAX_VALUE
      let maxGroup = 0
      // 从extractMapTwice挑选出数量最多的那组数据
      extractMapTwice.forEach((val, key) => {
        if (val >= maxVoteVal) {
          maxVote = key
          maxVoteVal = val
        }
      })
      // 有可能筛选出的行或列符合指标条件，但并不在二维码区域上，所以需要利用容差值过滤一下
      extractMap.forEach((val, key) => {
        if (val >= maxVote && val <= maxVote * (2 - this.precision)) {
          minGroup = Math.min(minGroup, key)
          maxGroup = Math.max(maxGroup, key)
        }
      })
      if (
        minGroup > maxLimit - 1 - (this.qrCodeSize + 2 * this.padding) ||
        maxGroup < this.qrCodeSize + 2 * this.padding
      ) {
        console.error('请扩大precision或减少padding')
      }
      return [minGroup, maxGroup]
    },
    extendBorder (minRow, maxRow, minCol, maxCol) {
      // 扩展范围，直到最大边界
      while (
        minRow > 0 &&
        this.tempImgData[minRow - 1][Math.floor((minCol + maxCol) / 2)] === 1 &&
        this.tempImgData[minRow - 1][minCol + this.padding] === 1 &&
        this.tempImgData[minRow - 1][maxCol - this.padding] === 1
      ) {
        minRow--
      }
      while (
        maxRow < this.tempImgData.length &&
        this.tempImgData[maxRow + 1][Math.floor((minCol + maxCol) / 2)] === 1 &&
        this.tempImgData[maxRow + 1][minCol + this.padding] === 1 &&
        this.tempImgData[maxRow + 1][maxCol - this.padding] === 1
      ) {
        maxRow++
      }
      while (
        minCol > 0 &&
        this.tempImgData[Math.floor((minRow + maxRow) / 2)][minCol - 1] === 1 &&
        this.tempImgData[minRow + this.padding][minCol + this.padding] === 1 &&
        this.tempImgData[maxRow - this.padding][maxCol - this.padding] === 1
      ) {
        minCol--
      }
      while (
        maxCol < this.tempImgData[0].length &&
        this.tempImgData[Math.floor((minRow + maxRow) / 2)][maxCol + 1] === 1 &&
        this.tempImgData[minRow + this.padding][minCol + this.padding] === 1 &&
        this.tempImgData[maxRow - this.padding][maxCol - this.padding] === 1
      ) {
        maxCol++
      }
      return [minRow, maxRow, minCol, maxCol]
    },
    drawLine (imgObj, top, bottom, left, right, R, G, B, A) {
      for (let i = 0; i < imgObj.length; i += 4) {
        let j = i / 4
        // imgObj[i] = imgObj[i + 1] = imgObj[i + 2] = 180
        if (
          Math.ceil(j / this.cWidth) === Math.ceil(top) ||
          Math.floor(j / this.cWidth) === Math.floor(bottom)
        ) {
          imgObj[i] = R
          imgObj[i + 1] = G
          imgObj[i + 2] = B
          imgObj[i + 3] = A
        }
        if (
          Math.ceil(j % this.cWidth) === Math.ceil(left) ||
          Math.floor(j % this.cWidth) === Math.floor(right)
        ) {
          imgObj[i] = R
          imgObj[i + 1] = G
          imgObj[i + 2] = B
          imgObj[i + 3] = A
        }
      }
    },
    recognizeImg () {
      let img_obj = this.$refs.img
      img_obj.onload = () => {
        this.drawCanvas(img_obj)

        this.getCanvasData()
        console.log(
          'base data',
          this.imgData,
          this.tempImgData,
          this.extractRowMap,
          this.extractColMap
        )

        // 计算出基础边界
        let [minRow, maxRow] = this.computeBorder(
          this.extractRowMap,
          this.tempImgData.length
        )
        let [minCol, maxCol] = this.computeBorder(
          this.extractColMap,
          this.tempImgData[0].length
        )
        console.log('border', minRow, maxRow, minCol, maxCol)

        // 如果需要的话，可以增强一下扩展
        let needExtend = true
        if (needExtend) {
          [minRow, maxRow, minCol, maxCol] = this.extendBorder(
            minRow,
            maxRow,
            minCol,
            maxCol
          )
          console.log('extend border', minRow, maxRow, minCol, maxCol)
        }

        // 获取中心点及定位点
        let point = [(minRow + maxRow) / 2, (minCol + maxCol) / 2]
        let top = point[0] - this.qrCodeSize / 2
        let bottom = point[0] + this.qrCodeSize / 2
        let left = point[1] - this.qrCodeSize / 2
        let right = point[1] + this.qrCodeSize / 2
        console.log('qrcode border', point, top, bottom, left, right)

        // 绘图imgData
        this.drawLine(
          this.imgData,
          minRow,
          maxRow,
          minCol,
          maxCol,
          0,
          255,
          0,
          80
        )
        this.drawLine(this.imgData, top, bottom, left, right, 255, 0, 0, 255)
        this.ctx.putImageData(this.imgMsg, 0, 0)
      }
    }
  },
  created () { },
  mounted () {
    this.recognizeImg()
  }
}
</script>

<style scoped></style>
