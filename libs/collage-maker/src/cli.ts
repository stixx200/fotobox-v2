import { CollageMaker } from './lib/collage-maker';
import { program } from 'commander';
import path from 'path';
import { resolveTemplate } from './templates';
import fs from 'node:fs/promises';

function parseCliArguments() {
  program
    .option(
      '--photo-dir <path>',
      'Directory containing photos. If not provided, no photos get rendered into the collage',
      '.'
    )
    .option(
      '--template-directory <path>',
      'Directory containing templates. If not specified, you can only use the built-in templates.',
      './templates'
    )
    .option('--template-id <id>', 'ID of the template to use', '2x2')
    .option(
      '--output <path>',
      'Output path for the collage image',
      'collage.jpg'
    )
    .argument(
      '[photos...]',
      'List of photo filenames to include in the collage. They get resolved relative to the photo directory.'
    );

  program.parse();

  return {
    ...(program.opts() as {
      photoDir: string;
      templateDirectory?: string;
      templateId: string;
      output: string;
    }),
    photos: program.args,
  };
}

async function main() {
  const options = parseCliArguments();

  const maker = new CollageMaker({
    photoDir: path.isAbsolute(options.photoDir)
      ? options.photoDir
      : path.resolve(process.cwd(), options.photoDir),
  });

  const template = resolveTemplate(
    options.templateId,
    options.templateDirectory
  );

  try {
    const collageBuffer = await maker.createCollage(template, options.photos);
    const outputPath = path.isAbsolute(options.output)
      ? options.output
      : path.resolve(process.cwd(), options.output);
    await fs.writeFile(outputPath, collageBuffer);
    console.log('Collage created successfully:', options.output);
  } catch (error) {
    console.error('Error creating collage:', error);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});
