const { supabase } = require('../lib/supabase');

class CVService {
  static async createCV(userUid, cvData) {
    // If setting as primary, unset other primary CVs
    if (cvData.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', userUid);
    }

    const cvDataWithUser = {
      user_uid: userUid,
      ...cvData,
      is_primary: cvData.is_primary || false,
    };

    const { data, error } = await supabase
      .from('cvs')
      .insert(cvDataWithUser)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getCVs(userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getCVById(cvId, userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .eq('user_uid', userUid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // CV not found
      }
      throw error;
    }

    return data;
  }

  static async updateCV(cvId, userUid, updateData) {
    // Check if CV belongs to user
    const existingCV = await this.getCVById(cvId, userUid);
    if (!existingCV) {
      throw new Error('CV not found or does not belong to you');
    }

    // If setting as primary, unset other primary CVs
    if (updateData.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', userUid)
        .neq('id', cvId);
    }

    const { data, error } = await supabase
      .from('cvs')
      .update(updateData)
      .eq('id', cvId)
      .eq('user_uid', userUid)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteCV(cvId, userUid) {
    // Check if CV belongs to user
    const existingCV = await this.getCVById(cvId, userUid);
    if (!existingCV) {
      throw new Error('CV not found or does not belong to you');
    }

    const { error } = await supabase
      .from('cvs')
      .delete()
      .eq('id', cvId)
      .eq('user_uid', userUid);

    if (error) throw error;
  }

  static async getPrimaryCV(userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('user_uid', userUid)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No primary CV found
      }
      throw error;
    }

    return data;
  }
}

module.exports = { CVService };
