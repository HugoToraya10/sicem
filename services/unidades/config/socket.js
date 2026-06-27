let io;

const setIo = (instance) => {
    io = instance;
}

const getIo = () => {
    return io;
}

module.exports = {setIo, getIo}