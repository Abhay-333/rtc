// Custom error for global handling
class ApiError extends Error{ // Inherit all the  properties of  Javascript Error class
    constructor(statusCode,message){ //constructor runs when new ApiError object is created
    // Call parent Error class constructor and pass error message
        super(message) 
    this.statusCode=statusCode  // Store HTTP status code like 400, 404, 500 etc.
    this.message=message     // Store custom error message
        
    }
}

// Export ApiError class so it can be used by other files
export default ApiError