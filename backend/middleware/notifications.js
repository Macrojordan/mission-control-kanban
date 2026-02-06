const { runQuery } = require('../database');

async function logActivity(taskId, action, description, performedBy = 'sistema') {
  try {
    await runQuery(`
      INSERT INTO activity_log (task_id, action, description, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [taskId, action, description, performedBy]);
  } catch (error) {
    console.error('Erro ao logar atividade:', error);
  }
}

async function notifyRandy(taskId, type, message) {
  try {
    await runQuery(`
      INSERT INTO randy_notifications (task_id, type, message)
      VALUES ($1, $2, $3)
    `, [taskId, type, message]);
    console.log(`🔔 Notificação para Randy: ${message}`);
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

module.exports = {
  logActivity,
  notifyRandy
};
