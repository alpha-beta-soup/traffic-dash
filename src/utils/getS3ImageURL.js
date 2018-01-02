module.exports = (cameraId, fileName) => {
  return `https://traffic-dash.s3.ap-southeast-2.amazonaws.com/${cameraId}/${encodeS3URI(fileName)}`;
}
