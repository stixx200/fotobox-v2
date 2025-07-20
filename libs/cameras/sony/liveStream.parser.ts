import * as _ from "lodash";
import { Observer } from "rxjs";

const logger = require("logger-winston").getLogger("camera.sony.livestreamparser");

enum RECEIVING_TYPE {
  commonHeader,
  payloadHeader,
  jpegData,
  frameData,
}

const typeToLength = {
  [RECEIVING_TYPE.commonHeader]: (paddingSize: number, payloadSize: number) => 8,
  [RECEIVING_TYPE.payloadHeader]: (paddingSize: number, payloadSize: number) => 128,
  [RECEIVING_TYPE.jpegData]: (paddingSize: number, payloadSize: number) => paddingSize + payloadSize,
  [RECEIVING_TYPE.frameData]: (paddingSize: number, payloadSize: number) => 16 + paddingSize,
};

class ReceivingInfo {
  payloadType = -1;
  paddingSize = -1;
  payloadSize = -1;
  frameCount = -1;
  frameSize = -1;

  constructor(
    data: {
      payloadType?: number;
      paddingSize?: number;
      payloadSize?: number;
      frameCount?: number;
      frameSize?: number;
    } = {},
  ) {
    this.payloadType = _.isNil(data.payloadType) ? this.payloadType : data.payloadType;
    this.paddingSize = _.isNil(data.paddingSize) ? this.paddingSize : data.paddingSize;
    this.payloadSize = _.isNil(data.payloadSize) ? this.payloadSize : data.payloadSize;
    this.frameCount = _.isNil(data.frameCount) ? this.frameCount : data.frameCount;
    this.frameSize = _.isNil(data.frameSize) ? this.frameSize : data.frameSize;
  }
}

export class LiveStreamParser {
  private receivingType = RECEIVING_TYPE.commonHeader;
  private receivingInfo: ReceivingInfo = new ReceivingInfo();
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private observer: Observer<Buffer>) {}

  private reset(receivingType: RECEIVING_TYPE, bufferOverlap: Buffer, receivingInfo?: ReceivingInfo) {
    this.receivingType = receivingType;
    this.buffer = bufferOverlap;
    this.receivingInfo = receivingInfo || new ReceivingInfo();
  }

  onNewChunk(data?: Buffer) {
    logger.silly("\nreceived new chunk:");

    // if new data is provided, add it to buffer
    if (data) {
      this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
    }
    // skip if not enough data are available
    if (
      this.buffer.length <
      typeToLength[this.receivingType](this.receivingInfo.paddingSize, this.receivingInfo.payloadSize)
    ) {
      return;
    }
    // trigger action
    switch (this.receivingType) {
      case RECEIVING_TYPE.commonHeader:
        this.parseCommonHeader();
        break;
      case RECEIVING_TYPE.payloadHeader:
        this.parsePayloadHeader();
        break;
      case RECEIVING_TYPE.jpegData:
        this.parseJpegData();
        break;
      case RECEIVING_TYPE.frameData:
        this.parseFrameData();
        break;
    }

    if (
      this.buffer.length >=
      typeToLength[this.receivingType](this.receivingInfo.paddingSize, this.receivingInfo.payloadSize)
    ) {
      this.onNewChunk();
    }
  }

  private parseCommonHeader() {
    const receivingInfo = new ReceivingInfo({ payloadType: this.buffer.readInt8(1) });
    this.reset(RECEIVING_TYPE.payloadHeader, this.buffer.slice(8), receivingInfo);
  }

  private parsePayloadHeader() {
    // check verification point
    if (
      !(
        this.buffer.readInt8(8).toString(16) !== "0x24" &&
        this.buffer.readInt8(9).toString(16) !== "0x35" &&
        this.buffer.readInt8(10).toString(16) !== "0x68" &&
        this.buffer.readInt8(11).toString(16) !== "0x79"
      )
    ) {
      throw new Error("Payload header start not detected");
    }

    const receivingInfo = new ReceivingInfo({
      payloadSize: this.buffer.readIntBE(4, 3),
      paddingSize: this.buffer.readInt8(7),
    });

    if (this.receivingInfo.payloadType === 1) {
      // no interesting information
      this.reset(RECEIVING_TYPE.jpegData, this.buffer.slice(128), receivingInfo);
    } else if (this.receivingInfo.payloadType === 2) {
      receivingInfo.frameCount = this.buffer.readIntBE(10, 2);
      receivingInfo.frameSize = this.buffer.readIntBE(12, 2);
      this.reset(RECEIVING_TYPE.frameData, this.buffer.slice(128), receivingInfo);
    } else {
      throw new Error(`Payloadtype unknown: ${this.receivingInfo.payloadType}`);
    }
  }

  private parseJpegData() {
    this.observer.next(this.buffer.slice(0, this.receivingInfo.payloadSize));
    this.reset(
      RECEIVING_TYPE.commonHeader,
      this.buffer.slice(this.receivingInfo.payloadSize + this.receivingInfo.paddingSize),
      null,
    );
  }

  private parseFrameData() {
    const packageSize = this.receivingInfo.payloadSize + this.receivingInfo.paddingSize;

    if (this.receivingInfo.frameCount === 1) {
      this.reset(RECEIVING_TYPE.commonHeader, this.buffer.slice(packageSize), null);
    } else {
      this.receivingInfo.frameCount = this.receivingInfo.frameCount - 1;
      this.reset(RECEIVING_TYPE.frameData, this.buffer.slice(packageSize), this.receivingInfo);
    }
  }
}
