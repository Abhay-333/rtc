// Create a custom response class for sending standardized API responses
class ApiResponse {

    // Constructor runs when new ApiResponse() object is created
    constructor( message, data = null) {

        // Store success status (true or false)
        this.success = true

        // Store response message
        this.message = message

        // Store response data (default is null if no data provided)
        this.data = data
    }
}

// Export ApiResponse class so it can be used in other files
export default ApiResponse