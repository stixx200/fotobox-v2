import * as _ from 'lodash';
import axios from 'axios';

interface IService {
  type: string;
  url: string;
}

let _id = 0;

function id(): number {
  return ++_id;
}

export class CameraProxy {
  constructor(private services: IService[]) {}

  async call(
    endpoint: string,
    method: string,
    params: any[] = [],
    version = '1.0'
  ) {
    const service = this.getService(endpoint);
    const response = await axios.post(service.url, {
      method,
      params,
      id: id(),
      version,
    });
    if (response.data.error) {
      throw new Error(
        `Error occured while requesting '${
          service.url
        } - method: ${method} - params: ${JSON.stringify(params)}': ${
          response.data.error
        }`
      );
    }
    return response.data.result;
  }

  private getService(type: string): IService {
    const service = _.find(this.services, ['type', type]);
    if (!service) {
      throw new Error(
        `service '${type}' not found. Available are: '${this.services
          .map((s) => s.type)
          .join("', '")}'`
      );
    }
    return service;
  }
}
