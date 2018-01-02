const aws = require('aws-sdk');

// NOTE FOR LOCAL DEVELOPMENT ONLY
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

module.exports = aws
