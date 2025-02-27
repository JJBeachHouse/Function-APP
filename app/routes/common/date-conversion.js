export function convertToDateTime (date, time) 
{
  console.log("converting ..")
  if (!date || !time) {
    console.error("Date or time is missing");
    return null;
  }
  const dateTimeString = `${date} ${time}`;
  console.log('dateTimeString ', dateTimeString)
  const dateTimeObject = new Date(dateTimeString + " GMT-0800");

  if (!isNaN(dateTimeObject)) { }
  console.log('dateTimeObject h', dateTimeObject.toISOString())
  return dateTimeObject.toISOString();
}
export function convertToEST(dateString) {
    if (!dateString) {
      console.error("Invalid date input");
      return null;
    }
  
    const utcDate = new Date(dateString);
    if (isNaN(utcDate.getTime())) {
      console.error("Invalid date format");
      return null;
    }
  
    const estOffsetMilliseconds = -8 * 60 * 60 * 1000;
    const estDate = new Date(utcDate.getTime() + estOffsetMilliseconds);
  
    return estDate.toISOString();
  }
  