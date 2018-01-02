const aws = require('./awsInit')

function uploadJpegBufferToS3(path, buffer) {
  const s3 = new aws.S3();
  return new Promise((resolve, reject) => {
    s3.upload({
      Bucket: 'traffic-dash',
      Key: path,
      Body: buffer,
      ACL: 'public-read'
    }, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve(data.Location)
    })
  })
}

if (module) {
  module.exports = uploadJpegBufferToS3
}
