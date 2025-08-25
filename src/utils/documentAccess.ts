import pool from "./db";

// Интерфейсы для типизации
interface DocumentAccess {
  id: number;
  document_id: number;
  username: string;
  granted_by: number;
  granted_at: Date;
  is_active: boolean;
}

interface DocumentAccessView {
  id: number;
  document_id: number;
  document_name: string;
  username: string;
  granted_by_username: string;
  granted_at: Date;
  is_active: boolean;
}

// Функция для предоставления доступа к документу
export async function grantDocumentAccess(
  documentId: number, 
  username: string, 
  grantedByAdminId: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Проверяем, что документ существует
    const docCheck = await pool.query("SELECT id FROM documents WHERE id = $1", [documentId]);
    if (docCheck.rows.length === 0) {
      return { success: false, message: "Документ не найден" };
    }

    // Проверяем, что админ существует
    const adminCheck = await pool.query("SELECT id FROM admins WHERE user_id = $1", [grantedByAdminId]);
    if (adminCheck.rows.length === 0) {
      return { success: false, message: "Администратор не найден" };
    }
    const adminId = adminCheck.rows[0].id;

    // Очищаем username от @ если есть
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!cleanUsername) {
      return { success: false, message: "Username не может быть пустым" };
    }

    // Проверяем, не предоставлен ли уже доступ
    const existingAccess = await pool.query(
      "SELECT id FROM document_access WHERE document_id = $1 AND username = $2",
      [documentId, cleanUsername]
    );

    if (existingAccess.rows.length > 0) {
      // Если доступ уже есть, активируем его
      await pool.query(
        "UPDATE document_access SET is_active = TRUE, granted_by = $1, granted_at = CURRENT_TIMESTAMP WHERE document_id = $2 AND username = $3",
        [adminId, documentId, cleanUsername]
      );
      return { success: true, message: `Доступ к документу для @${cleanUsername} обновлен` };
    }

    // Предоставляем новый доступ
    await pool.query(
      "INSERT INTO document_access (document_id, username, granted_by) VALUES ($1, $2, $3)",
      [documentId, cleanUsername, adminId]
    );

    return { success: true, message: `Доступ к документу предоставлен для @${cleanUsername}` };
  } catch (error) {
    console.error("Ошибка при предоставлении доступа:", error);
    return { success: false, message: "Ошибка при предоставлении доступа" };
  }
}

// Функция для отзыва доступа к документу
export async function revokeDocumentAccess(
  documentId: number, 
  username: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const result = await pool.query(
      "UPDATE document_access SET is_active = FALSE WHERE document_id = $1 AND username = $2 RETURNING id",
      [documentId, cleanUsername]
    );

    if (result.rows.length === 0) {
      return { success: false, message: `Доступ для @${cleanUsername} не найден` };
    }

    return { success: true, message: `Доступ для @${cleanUsername} отозван` };
  } catch (error) {
    console.error("Ошибка при отзыве доступа:", error);
    return { success: false, message: "Ошибка при отзыве доступа" };
  }
}

// Функция для проверки доступа пользователя к документу
export async function checkDocumentAccess(
  documentId: number, 
  username: string
): Promise<boolean> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const result = await pool.query(
      "SELECT id FROM document_access WHERE document_id = $1 AND username = $2 AND is_active = TRUE",
      [documentId, cleanUsername]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error("Ошибка при проверке доступа:", error);
    return false;
  }
}

// Функция для получения списка пользователей с доступом к документу
export async function getDocumentAccessList(
  documentId: number
): Promise<{ success: boolean; accessList: DocumentAccessView[]; message?: string }> {
  try {
    const result = await pool.query(
      "SELECT * FROM document_access_view WHERE document_id = $1 ORDER BY granted_at DESC",
      [documentId]
    );

    return { success: true, accessList: result.rows };
  } catch (error) {
    console.error("Ошибка при получении списка доступа:", error);
    return { success: false, accessList: [], message: "Ошибка при получении списка доступа" };
  }
}

// Функция для получения всех документов с доступом для пользователя
export async function getUserAccessibleDocuments(
  username: string
): Promise<{ success: boolean; documents: any[]; message?: string }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const result = await pool.query(`
      SELECT d.id, d.original_name, d.filename, d.type, d.uploaded_at, c.name as category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      INNER JOIN document_access da ON d.id = da.document_id
      WHERE da.username = $1 AND da.is_active = TRUE
      ORDER BY d.uploaded_at DESC
    `, [cleanUsername]);

    return { success: true, documents: result.rows };
  } catch (error) {
    console.error("Ошибка при получении доступных документов:", error);
    return { success: false, documents: [], message: "Ошибка при получении доступных документов" };
  }
}

// Функция для получения всех документов БЕЗ доступа для пользователя
export async function getUserInaccessibleDocuments(
  username: string
): Promise<{ success: boolean; documents: any[]; message?: string }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    const result = await pool.query(`
      SELECT d.id, d.original_name, d.filename, d.type, d.uploaded_at, c.name as category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.id NOT IN (
        SELECT document_id 
        FROM document_access 
        WHERE username = $1 AND is_active = TRUE
      )
      ORDER BY d.uploaded_at DESC
    `, [cleanUsername]);

    return { success: true, documents: result.rows };
  } catch (error) {
    console.error("Ошибка при получении недоступных документов:", error);
    return { success: false, documents: [], message: "Ошибка при получении недоступных документов" };
  }
}

// Функция для получения статистики доступа
export async function getAccessStatistics(): Promise<{ success: boolean; stats: any; message?: string }> {
  try {
    const totalDocs = await pool.query("SELECT COUNT(*) as count FROM documents");
    const totalAccess = await pool.query("SELECT COUNT(*) as count FROM document_access WHERE is_active = TRUE");
    const uniqueUsers = await pool.query("SELECT COUNT(DISTINCT username) as count FROM document_access WHERE is_active = TRUE");
    const recentAccess = await pool.query(`
      SELECT COUNT(*) as count 
      FROM document_access 
      WHERE is_active = TRUE AND granted_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    return {
      success: true,
      stats: {
        totalDocuments: parseInt(totalDocs.rows[0].count),
        totalAccessGrants: parseInt(totalAccess.rows[0].count),
        uniqueUsersWithAccess: parseInt(uniqueUsers.rows[0].count),
        recentAccessGrants: parseInt(recentAccess.rows[0].count)
      }
    };
  } catch (error) {
    console.error("Ошибка при получении статистики:", error);
    return { success: false, stats: {}, message: "Ошибка при получении статистики" };
  }
}

// Функция для массового предоставления доступа ко всем документам
export async function grantAccessToAllDocuments(
  username: string, 
  grantedByAdminId: number
): Promise<{ success: boolean; message: string; grantedCount: number }> {
  try {
    // Проверяем, что админ существует
    const adminCheck = await pool.query("SELECT id FROM admins WHERE user_id = $1", [grantedByAdminId]);
    if (adminCheck.rows.length === 0) {
      return { success: false, message: "Администратор не найден", grantedCount: 0 };
    }
    const adminId = adminCheck.rows[0].id;

    // Очищаем username от @ если есть
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!cleanUsername) {
      return { success: false, message: "Username не может быть пустым", grantedCount: 0 };
    }

    // Получаем все документы
    const docsResult = await pool.query("SELECT id FROM documents");
    if (docsResult.rows.length === 0) {
      return { success: false, message: "Нет документов в базе данных", grantedCount: 0 };
    }

    let grantedCount = 0;
    for (const doc of docsResult.rows) {
      // Проверяем, не предоставлен ли уже доступ
      const existingAccess = await pool.query(
        "SELECT id FROM document_access WHERE document_id = $1 AND username = $2",
        [doc.id, cleanUsername]
      );

      if (existingAccess.rows.length > 0) {
        // Если доступ уже есть, активируем его
        await pool.query(
          "UPDATE document_access SET is_active = TRUE, granted_by = $1, granted_at = CURRENT_TIMESTAMP WHERE document_id = $2 AND username = $3",
          [adminId, doc.id, cleanUsername]
        );
      } else {
        // Предоставляем новый доступ
        await pool.query(
          "INSERT INTO document_access (document_id, username, granted_by) VALUES ($1, $2, $3)",
          [doc.id, cleanUsername, adminId]
        );
      }
      grantedCount++;
    }

    return { 
      success: true, 
      message: `Доступ ко всем документам (${grantedCount}) предоставлен для @${cleanUsername}`, 
      grantedCount 
    };
  } catch (error) {
    console.error("Ошибка при массовом предоставлении доступа:", error);
    return { success: false, message: "Ошибка при массовом предоставлении доступа", grantedCount: 0 };
  }
}

// Функция для массового отзыва доступа ко всем документам
export async function revokeAccessFromAllDocuments(
  username: string
): Promise<{ success: boolean; message: string; revokedCount: number }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!cleanUsername) {
      return { success: false, message: "Username не может быть пустым", revokedCount: 0 };
    }

    const result = await pool.query(
      "UPDATE document_access SET is_active = FALSE WHERE username = $1 RETURNING id",
      [cleanUsername]
    );

    return { 
      success: true, 
      message: `Доступ ко всем документам отозван для @${cleanUsername}`, 
      revokedCount: result.rows.length 
    };
  } catch (error) {
    console.error("Ошибка при массовом отзыве доступа:", error);
    return { success: false, message: "Ошибка при массовом отзыве доступа", revokedCount: 0 };
  }
}

// Функция для получения списка всех пользователей с доступом
export async function getAllUsersWithAccess(): Promise<{ success: boolean; users: any[]; message?: string }> {
  try {
    const result = await pool.query(`
      SELECT DISTINCT username, 
             COUNT(*) as document_count,
             MAX(granted_at) as last_granted
      FROM document_access 
      WHERE is_active = TRUE 
      GROUP BY username 
      ORDER BY last_granted DESC
    `);

    return { success: true, users: result.rows };
  } catch (error) {
    console.error("Ошибка при получении списка пользователей:", error);
    return { success: false, users: [], message: "Ошибка при получении списка пользователей" };
  }
}

// Функция для получения списка всех пользователей БЕЗ доступа
export async function getAllUsersWithoutAccess(): Promise<{ success: boolean; users: any[]; message?: string }> {
  try {
    // Получаем всех пользователей, которые когда-либо получали доступ
    const usersWithAccess = await pool.query(`
      SELECT DISTINCT username FROM document_access
    `);
    
    const usernamesWithAccess = usersWithAccess.rows.map(row => row.username);
    
    // Получаем всех пользователей из search_logs, у которых нет доступа
    const result = await pool.query(`
      SELECT DISTINCT username, 
             COUNT(*) as search_count,
             MAX(created_at) as last_search
      FROM search_logs 
      WHERE username IS NOT NULL 
      AND username NOT IN (${usernamesWithAccess.length > 0 ? usernamesWithAccess.map((_, i) => `$${i + 1}`).join(',') : 'NULL'})
      GROUP BY username 
      ORDER BY last_search DESC
    `, usernamesWithAccess.length > 0 ? usernamesWithAccess : []);

    return { success: true, users: result.rows };
  } catch (error) {
    console.error("Ошибка при получении списка пользователей без доступа:", error);
    return { success: false, users: [], message: "Ошибка при получении списка пользователей без доступа" };
  }
} 