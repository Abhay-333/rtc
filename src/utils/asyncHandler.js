//  Create asyncHandler function to handle async errors automatically   
const  asyncHandler=(requestHandler)=>{
    // Return a middleware
    return (req,res,next)=>{

        // Resolve async function controller
        Promise.resolve(requestHandler(req,res,next))
        // Catch any error and pass it to global error middleware
        .catch((error)=>{
            next(error)
        })
    }

}

export default asyncHandler;