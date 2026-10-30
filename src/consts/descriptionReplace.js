export default Object.freeze({
  Mwy: 'Motorway',
  Hwy: 'Highway',
  Hbr: 'Harbour',
  Northn: 'Northern',
  Nthn: 'Northern',
  Nth: 'North',
  Southn: 'Southern',
  Sthn: 'Southern',
  Sth: 'South',
  Wstn: 'Western',
  Exwy: 'Expressway',
  Gt: 'Great',
  Rd: 'Road',
  // Street after a name ("Durham St"), but Saint at the start or after a lowercase word
  // ("in St Arnaud", "from St Andrew St"), which is left as it is
  St: before => (/[A-Z]\S*\s+$/.test(before) ? 'Street' : null),
  Dr: 'Drive',
  Ave: 'Avenue',
  Pl: 'Place'
})
