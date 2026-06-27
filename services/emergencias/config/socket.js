let io;

const setIo = (serverIo) =>{
    io = serverIo;
}

const getIo = () =>{
    return io;
}

module.exports = {setIo, getIo}