import * as path from 'path';
import { PhotoSpace, TemplateInterface } from '../../lib/template.interface';
import { Merge } from 'type-fest';

const aspectRatio = 3 / 2;
const photoBorder = {
  background: { r: 255, g: 255, b: 255 },
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};
const total_border = {
  background: { r: 255, g: 255, b: 255, alpha: 1 },
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};
const width = 1796;
const height = 1204;
const borderDistance = {
  vertical: Math.ceil(width * 0.04),
  horizontal: Math.ceil(width * 0.06),
};
const verticalDistance = Math.ceil(height * 0.04);

const photoHeight = Math.floor(
  (height -
    photoBorder.top -
    photoBorder.bottom -
    2 * borderDistance.vertical -
    verticalDistance) /
    2
);
const photo: Merge<PhotoSpace, { x: null; y: null }> = {
  type: 'photo',
  width: Math.floor(photoHeight * aspectRatio),
  height: photoHeight,
  border: photoBorder,
  x: null,
  y: null,
};
const horizontalDistance =
  width -
  total_border.left -
  total_border.right -
  2 * borderDistance.horizontal -
  2 * photo.width;
const calculateX = (i: number) =>
  Math.floor(
    total_border.left +
      borderDistance.horizontal +
      i * (photo.width + horizontalDistance)
  );
const calculateY = (i: number) =>
  Math.floor(
    total_border.top +
      borderDistance.vertical +
      i * (photo.height + verticalDistance)
  );

const template: TemplateInterface = {
  id: '2x2',
  width: width,
  height: height,
  border: total_border,
  background: path.join(__dirname, 'background.jpg'),
  spaces: [
    {
      ...photo,
      x: calculateX(0),
      y: calculateY(0),
      rotation: 2,
    },
    {
      ...photo,
      x: calculateX(1),
      y: calculateY(0),
      rotation: 355,
    },
    {
      ...photo,
      x: calculateX(0),
      y: calculateY(1),
      rotation: 357,
    },
    {
      ...photo,
      x: calculateX(1),
      y: calculateY(1),
      rotation: 1,
    },
  ],
};

export default template;
