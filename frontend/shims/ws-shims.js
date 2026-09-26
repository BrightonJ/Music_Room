module.exports = typeof WebSocket !== 'undefined'
  ? WebSocket
  : function () {
      throw new Error('WebSocket is not available in this environment');
    };