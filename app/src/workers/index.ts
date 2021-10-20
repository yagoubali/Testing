import config from '../config/bullmq.config';
import { WorkerJob } from '../jobqueue/queue/annot.queue';
import { Worker, Job, QueueScheduler } from 'bullmq';
import {
  AnnotationJobsModel,
  JobStatus,
} from '../jobs/models/annotation.jobs.model';
import * as path from 'path';

let scheduler;

const createScheduler = () => {
  scheduler = new QueueScheduler(config.queueName, {
    connection: config.connection,
    // maxStalledCount: 10,
    // stalledInterval: 15000,
  });
};

export var runningJobs = {
  value: 0,
};

const processorFile = path.join(__dirname, 'worker.js');

export const createWorkers = async () => {
  createScheduler();
  console.log(config);
  for (let i = 0; i < config.numWorkers; i++) {
    console.log('Creating worker ' + i);

    const worker = new Worker<WorkerJob>(config.queueName, processorFile, {
      connection: config.connection,
      // concurrency: config.concurrency,
      limiter: config.limiter,
    });

    worker.on('completed', (job: Job, returnvalue: any) => {
      console.log('worker ' + i + ' completed ' + returnvalue);
    });

    worker.on('failed', async (job: Job) => {
      console.log('worker ' + i + ' failed ' + job.failedReason);
      //update job in database as failed
      //save in mongo database
      await AnnotationJobsModel.findByIdAndUpdate(
        job.data.jobId,
        {
          status: JobStatus.FAILED,
        },
        { new: true },
      );
    });

    // worker.on('close', () => {
    //   console.log('worker ' + i + ' closed');
    // });

    process.on('SIGINT', () => {
      worker.close();
      console.log('worker ' + i + ' closed');
    });

    process.on('SIGTERM', () => {
      worker.close();
      console.log('worker ' + i + ' closed');
    });

    process.on('SIGBREAK', () => {
      worker.close();
      console.log('worker ' + i + ' closed');
    });

    console.log('Worker ' + i + ' created');
  }
};
