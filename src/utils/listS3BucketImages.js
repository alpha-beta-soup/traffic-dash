const aws = require('./awsInit')
const moment = require('moment-timezone')

function listImagesInS3(prefix, noOlder) {
  const s3 = new aws.S3();
  return new Promise((resolve, reject) => {
    s3.listObjectsV2({
      Bucket: 'traffic-dash',
      Prefix: prefix,
    }, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve(data.Contents.filter(obj => {
        if (!noOlder) return true
        return moment().diff(moment(obj.LastModified)) < noOlder
      }).map(obj => {
        return obj.Key
      }))
    })
  })
}

if (module) {
  module.exports = listImagesInS3
}
