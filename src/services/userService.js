const { supabase } = require('../lib/supabase');

class UserService {
  static async createProfile(userUid, email, profileData) {
    const profileDataWithUid = {
      firebase_uid: userUid,
      email: email || profileData.email,
      ...profileData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profileDataWithUid)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Profile already exists');
      }
      throw error;
    }

    return data;
  }

  static async getProfile(userUid) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('firebase_uid', userUid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Profile not found
      }
      throw error;
    }

    return data;
  }

  static async updateProfile(userUid, updateData) {
    const updateDataWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateDataWithTimestamp)
      .eq('firebase_uid', userUid)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Profile not found');
      }
      throw error;
    }

    return data;
  }

  static async checkUserType(userUid, requiredType) {
    const profile = await this.getProfile(userUid);
    if (!profile) {
      throw new Error('User profile not found');
    }
    return profile.user_type === requiredType;
  }
}

module.exports = { UserService };
